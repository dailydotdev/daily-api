import { type DataSource, type EntityManager } from 'typeorm';
import { HighlightsCanonical } from '../../entity/HighlightsCanonical';
import { UNKNOWN_SOURCE } from '../../entity/Source';
import { getChannelDigestSourceIds } from '../channelDigest/definitions';
import {
  DEFAULT_CANDIDATE_HORIZON_HOURS,
  DEFAULT_MAX_ITEMS,
} from './constants';
import { compareSnapshots } from './decisions';
import { evaluateHighlights } from './evaluate';
import {
  createHighlightChannelResolver,
  type HighlightChannelResolver,
} from './channels';
import { upsertCanonicalHighlights } from './publish';
import {
  fetchCollectionMembership,
  fetchEvaluationHistoryCanonicalHighlights,
  fetchIncrementalPosts,
  fetchPostsByIds,
  fetchPublicShareFallbackPostIds,
  fetchRelations,
  getFetchStart,
  getHorizonStart,
  mergePosts,
} from './queries';
import {
  applyPublicShareFallbackToCandidates,
  applyPublicShareFallbackToHighlights,
  buildCandidates,
  canonicalizeCurrentHighlights,
  toHighlightItem,
} from './stories';
import type { PostRelation } from '../../entity/posts/PostRelation';
import type { HighlightCandidate, HighlightItem, HighlightPost } from './types';
import { dedupeHighlightsByPostId } from './utils';

export type GenerationConfig = {
  horizonStart: Date;
  fetchStart: Date;
  maxItems: number;
};

export type CanonicalInput = {
  excludedSourceIds: string[];
  canonicalHistoryRows: HighlightsCanonical[];
  incrementalPosts: HighlightPost[];
  relationPosts: HighlightPost[];
  availablePosts: HighlightPost[];
  relations: PostRelation[];
  inaccessiblePostIds: Set<string>;
  fallbackPostIds: Map<string, string>;
};

export type CanonicalHighlights = {
  history: HighlightItem[];
  newCandidates: HighlightCandidate[];
  admitted: HighlightItem[];
  snapshot: HighlightItem[];
  comparison: ReturnType<typeof compareSnapshots>;
  itemsToUpsert: HighlightItem[];
  channelsByPostId: Map<string, Set<string>>;
};

export const getGenerationConfig = ({
  now,
  lastFetchedAt,
}: {
  now: Date;
  lastFetchedAt: Date | null;
}): GenerationConfig => {
  const horizonStart = getHorizonStart({
    now,
    definition: {
      candidateHorizonHours: DEFAULT_CANDIDATE_HORIZON_HOURS,
    },
  });
  const fetchStart = getFetchStart({
    now,
    definition: {
      candidateHorizonHours: DEFAULT_CANDIDATE_HORIZON_HOURS,
      lastFetchedAt,
    },
  });

  return {
    horizonStart,
    fetchStart,
    maxItems: DEFAULT_MAX_ITEMS,
  };
};

export const loadCanonicalInput = async ({
  con,
  config,
  now,
}: {
  con: DataSource;
  config: GenerationConfig;
  now: Date;
}): Promise<CanonicalInput> => {
  const [excludedSourceIds, canonicalHistoryRows] = await Promise.all([
    getChannelDigestSourceIds({
      con,
    }),
    fetchEvaluationHistoryCanonicalHighlights({
      con,
      now,
    }),
  ]);
  const evaluationHistoryPostIds = [
    ...new Set(canonicalHistoryRows.map((item) => item.postId)),
  ];
  const [incrementalPosts, evaluationHistoryPosts] = await Promise.all([
    fetchIncrementalPosts({
      con,
      fetchStart: config.fetchStart,
      horizonStart: config.horizonStart,
      excludedSourceIds,
    }),
    fetchPostsByIds({
      con,
      ids: evaluationHistoryPostIds,
      excludedSourceIds,
    }),
  ]);
  const basePosts = mergePosts([incrementalPosts, evaluationHistoryPosts]);
  const sharedUnderlyingIds = [
    ...new Set(
      basePosts
        .map((post) => post.sharedPostId)
        .filter((id): id is string => !!id),
    ),
  ];
  const [relations, sharedUnderlyingPosts] = await Promise.all([
    fetchRelations({
      con,
      postIds: basePosts.map((post) => post.id),
    }),
    fetchPostsByIds({
      con,
      ids: sharedUnderlyingIds,
      excludedSourceIds,
    }),
  ]);
  const relationPosts = await fetchPostsByIds({
    con,
    ids: [
      ...new Set(
        relations.flatMap((relation) => [
          relation.postId,
          relation.relatedPostId,
        ]),
      ),
    ],
    excludedSourceIds,
  });
  const availablePosts = mergePosts([
    basePosts,
    relationPosts,
    sharedUnderlyingPosts,
  ]);
  const inaccessiblePostIds = new Set(
    availablePosts
      .filter((post) => post.sourceId === UNKNOWN_SOURCE)
      .map((post) => post.id),
  );
  const fallbackPostIds = await fetchPublicShareFallbackPostIds({
    con,
    sharedPostIds: [...new Set(availablePosts.map((post) => post.id))],
    excludedSourceIds,
  });

  return {
    excludedSourceIds,
    canonicalHistoryRows,
    incrementalPosts,
    relationPosts,
    availablePosts,
    relations,
    inaccessiblePostIds,
    fallbackPostIds,
  };
};

const toCanonicalChannels = ({
  items,
  channelResolver,
}: {
  items: HighlightItem[];
  channelResolver: HighlightChannelResolver;
}): Map<string, Set<string>> =>
  new Map(
    items.map((item) => [item.postId, new Set(channelResolver(item.postId))]),
  );

const selectNewCandidates = ({
  input,
  config,
  canonicalHistoryPostIds,
  channelResolver,
}: {
  input: CanonicalInput;
  config: GenerationConfig;
  canonicalHistoryPostIds: Set<string>;
  channelResolver: HighlightChannelResolver;
}): HighlightCandidate[] =>
  applyPublicShareFallbackToCandidates({
    candidates: buildCandidates({
      posts: input.availablePosts,
      relations: input.relations,
      horizonStart: config.horizonStart,
    }),
    inaccessiblePostIds: input.inaccessiblePostIds,
    fallbackPostIds: input.fallbackPostIds,
  }).filter((candidate) => {
    if (canonicalHistoryPostIds.has(candidate.postId)) {
      return false;
    }

    return channelResolver(candidate.postId).length > 0;
  });

const evaluateNewHighlights = async ({
  config,
  canonicalHistory,
  newCandidates,
  now,
}: {
  config: GenerationConfig;
  canonicalHistory: HighlightItem[];
  newCandidates: HighlightCandidate[];
  now: Date;
}): Promise<HighlightItem[]> => {
  if (!newCandidates.length) {
    return [];
  }

  const result = await evaluateHighlights({
    maxItems: config.maxItems,
    currentHighlights: canonicalHistory,
    newCandidates,
  });

  return result.items.map<HighlightItem>((item) => ({
    postId: item.postId,
    headline: item.headline,
    summary: null,
    highlightedAt: now,
    significanceLabel: item.significanceLabel,
    reason: item.reason,
  }));
};

export const generateCanonicalHighlights = async ({
  con,
  input,
  config,
  now,
}: {
  con: DataSource;
  input: CanonicalInput;
  config: GenerationConfig;
  now: Date;
}): Promise<CanonicalHighlights> => {
  const channelResolver = createHighlightChannelResolver({
    posts: input.availablePosts,
    relations: input.relations,
    fallbackPostIds: input.fallbackPostIds,
  });
  const canonicalHistory = dedupeHighlightsByPostId(
    applyPublicShareFallbackToHighlights({
      highlights: canonicalizeCurrentHighlights({
        highlights: input.canonicalHistoryRows.map(toHighlightItem),
        relations: input.relations,
        posts: input.availablePosts,
        inaccessiblePostIds: input.inaccessiblePostIds,
      }),
      inaccessiblePostIds: input.inaccessiblePostIds,
      fallbackPostIds: input.fallbackPostIds,
    }),
  );
  const canonicalHistoryPostIds = new Set(
    canonicalHistory.map((item) => item.postId),
  );
  const originalHistoryPostIds = new Set(
    input.canonicalHistoryRows.map((highlight) => highlight.postId),
  );
  const maintenanceItems = canonicalHistory.filter(
    (item) => !originalHistoryPostIds.has(item.postId),
  );
  const newCandidates = selectNewCandidates({
    input,
    config,
    canonicalHistoryPostIds,
    channelResolver,
  });
  const evaluatedHighlights = await evaluateNewHighlights({
    config,
    canonicalHistory,
    newCandidates,
    now,
  });
  const admitted = await dropAdmissionsRacingCollections({
    con,
    admitted: evaluatedHighlights,
    fallbackPostIds: input.fallbackPostIds,
    currentHighlightPostIds: canonicalHistoryPostIds,
  });
  const snapshot = dedupeHighlightsByPostId([...canonicalHistory, ...admitted]);
  const comparison = compareSnapshots({
    baseline: canonicalHistory,
    internal: snapshot,
  });
  const itemsToUpsert = dedupeHighlightsByPostId([
    ...admitted,
    ...maintenanceItems,
  ]);

  return {
    history: canonicalHistory,
    newCandidates,
    admitted,
    snapshot,
    comparison,
    itemsToUpsert,
    channelsByPostId: toCanonicalChannels({
      items: itemsToUpsert,
      channelResolver,
    }),
  };
};

export const saveCanonicalHighlights = ({
  manager,
  canonical,
  relations,
}: {
  manager: EntityManager;
  canonical: CanonicalHighlights;
  relations: PostRelation[];
}): Promise<HighlightsCanonical[]> => {
  if (!canonical.itemsToUpsert.length) {
    return Promise.resolve([]);
  }

  return upsertCanonicalHighlights({
    manager,
    items: canonical.itemsToUpsert,
    channelsByPostId: canonical.channelsByPostId,
    relations,
  });
};

const dropAdmissionsRacingCollections = async ({
  con,
  admitted,
  fallbackPostIds,
  currentHighlightPostIds,
}: {
  con: DataSource;
  admitted: HighlightItem[];
  fallbackPostIds: Map<string, string>;
  currentHighlightPostIds: Set<string>;
}): Promise<HighlightItem[]> => {
  if (!admitted.length) return admitted;

  const shareToUnderlying = new Map(
    [...fallbackPostIds].map(([underlying, share]) => [share, underlying]),
  );
  const underlyingId = (postId: string) =>
    shareToUnderlying.get(postId) ?? postId;

  const { collectionByChild, childrenByCollection } =
    await fetchCollectionMembership({
      con,
      postIds: [...new Set(admitted.map((item) => underlyingId(item.postId)))],
    });
  if (!collectionByChild.size && !childrenByCollection.size) return admitted;

  const isCovered = (postId: string): boolean => {
    const aliased = fallbackPostIds.get(postId) ?? postId;
    return (
      currentHighlightPostIds.has(postId) ||
      currentHighlightPostIds.has(aliased)
    );
  };

  return admitted.filter((item) => {
    const postId = underlyingId(item.postId);
    const collectionId = collectionByChild.get(postId) || postId;
    if (!childrenByCollection.has(collectionId)) return true;
    const members = [
      collectionId,
      ...(childrenByCollection.get(collectionId) ?? []),
    ];
    return !members.some(isCovered);
  });
};
