import { Brackets, In, MoreThanOrEqual, type DataSource } from 'typeorm';
import { logger as baseLogger } from '../../logger';
import { ONE_DAY_IN_SECONDS, ONE_HOUR_IN_SECONDS } from '../constants';
import { queryReadReplica } from '../queryReadReplica';
import { ChannelHighlightDefinition } from '../../entity/ChannelHighlightDefinition';
import { ChannelHighlightRun } from '../../entity/ChannelHighlightRun';
import { ChannelHighlightState } from '../../entity/ChannelHighlightState';
import { PostHighlight } from '../../entity/PostHighlight';
import { Post, PostContentQuality } from '../../entity/posts/Post';
import {
  PostRelation,
  PostRelationType,
} from '../../entity/posts/PostRelation';
import {
  channelHighlightCandidatePoolSchema,
  emptyChannelHighlightCandidatePool,
  type ChannelHighlightCandidatePool,
  type StoredHighlightStory,
} from './schema';
import {
  evaluateChannelHighlights,
  type EvaluatedHighlightItem,
  type HighlightQualitySummary,
  type HighlightStoryCandidate,
} from './evaluate';
import { replaceHighlightsForChannel } from './publish';

const HIGHLIGHT_FETCH_OVERLAP_SECONDS = 10 * 60;
const MAX_CANDIDATE_POOL_STORIES = 50;
const SHORTLIST_MULTIPLIER = 3;

type HighlightPost = Pick<
  Post,
  | 'id'
  | 'type'
  | 'title'
  | 'summary'
  | 'createdAt'
  | 'metadataChangedAt'
  | 'statsUpdatedAt'
  | 'upvotes'
  | 'comments'
  | 'views'
  | 'sourceId'
  | 'contentCuration'
  | 'contentQuality'
  | 'visible'
  | 'deleted'
  | 'banned'
  | 'showOnFeed'
  | 'contentMeta'
> & {
  url: string | null;
  canonicalUrl: string | null;
};

type HighlightStory = {
  storyKey: string;
  canonicalPost: HighlightPost;
  memberPosts: HighlightPost[];
  collectionId: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  preliminaryScore: number;
  cached?: StoredHighlightStory | null;
};

type HighlightBaselineItem = {
  postId: string;
  rank: number;
  headline: string;
  storyKey: string;
};

type GenerateChannelHighlightResult = {
  run: ChannelHighlightRun;
  published: boolean;
};

const getHorizonStart = ({
  now,
  definition,
}: {
  now: Date;
  definition: Pick<ChannelHighlightDefinition, 'candidateHorizonHours'>;
}): Date =>
  new Date(
    now.getTime() -
      definition.candidateHorizonHours * ONE_HOUR_IN_SECONDS * 1000,
  );

const getFetchStart = ({
  now,
  definition,
  state,
}: {
  now: Date;
  definition: Pick<ChannelHighlightDefinition, 'candidateHorizonHours'>;
  state: Pick<ChannelHighlightState, 'lastFetchedAt'> | null;
}): Date => {
  const horizonStart = getHorizonStart({
    now,
    definition,
  });

  if (!state?.lastFetchedAt) {
    return horizonStart;
  }

  const overlapStart = new Date(
    state.lastFetchedAt.getTime() - HIGHLIGHT_FETCH_OVERLAP_SECONDS * 1000,
  );

  return overlapStart > horizonStart ? overlapStart : horizonStart;
};

const parseCandidatePool = (
  value: ChannelHighlightState['candidatePool'] | null | undefined,
): ChannelHighlightCandidatePool => {
  const parsed = channelHighlightCandidatePoolSchema.safeParse(value);
  return parsed.success ? parsed.data : emptyChannelHighlightCandidatePool();
};

const toLastActivityAt = (post: HighlightPost): Date => {
  const candidates = [
    post.createdAt?.getTime() || 0,
    post.metadataChangedAt?.getTime() || 0,
    post.statsUpdatedAt?.getTime() || 0,
  ];
  return new Date(Math.max(...candidates));
};

const toQualitySummary = (
  quality: PostContentQuality,
): HighlightQualitySummary => ({
  clickbaitProbability:
    typeof quality?.is_clickbait_probability === 'number'
      ? quality.is_clickbait_probability
      : null,
  specificity: quality?.specificity || null,
  intent: quality?.intent || null,
  substanceDepth: quality?.substance_depth || null,
  titleContentAlignment: quality?.title_content_alignment || null,
  selfPromotionScore:
    typeof quality?.self_promotion_score === 'number'
      ? quality.self_promotion_score
      : null,
});

const getStoryKey = ({
  canonicalPost,
  collectionId,
}: {
  canonicalPost: HighlightPost;
  collectionId: string | null;
}): string => {
  if (collectionId) {
    return `collection:${collectionId}`;
  }

  const canonicalUrl = canonicalPost.canonicalUrl || canonicalPost.url;
  if (canonicalUrl) {
    return `url:${canonicalUrl.toLowerCase().trim()}`;
  }

  return `post:${canonicalPost.id}`;
};

const toPreliminaryScore = ({
  story,
  horizonStart,
  referenceTime,
}: {
  story: Omit<HighlightStory, 'preliminaryScore'>;
  horizonStart: Date;
  referenceTime: Date;
}): number => {
  const ageSeconds = Math.max(
    1,
    (referenceTime.getTime() - story.canonicalPost.createdAt.getTime()) / 1000,
  );
  const horizonSeconds = Math.max(
    ONE_DAY_IN_SECONDS,
    (referenceTime.getTime() - horizonStart.getTime()) / 1000,
  );
  const recency = Math.max(0.15, 1 - ageSeconds / horizonSeconds);
  const engagement =
    story.canonicalPost.upvotes +
    story.canonicalPost.comments * 2 +
    story.canonicalPost.views / 200;
  const collectionBoost = story.collectionId ? 8 : 0;
  const curationBoost = story.canonicalPost.contentCuration.some((value) =>
    ['news', 'release', 'milestone', 'leak', 'drama'].includes(value),
  )
    ? 5
    : 0;
  const quality = toQualitySummary(story.canonicalPost.contentQuality || {});
  const penalty =
    (quality.clickbaitProbability || 0) * 5 +
    (quality.selfPromotionScore || 0) * 3;

  return Number(
    (engagement * recency + collectionBoost + curationBoost - penalty).toFixed(
      3,
    ),
  );
};

const selectCanonicalPost = (posts: HighlightPost[]): HighlightPost =>
  posts.slice().sort((left, right) => {
    const leftScore = left.upvotes + left.comments * 2 + left.views / 200;
    const rightScore = right.upvotes + right.comments * 2 + right.views / 200;
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    return right.createdAt.getTime() - left.createdAt.getTime();
  })[0];

const fetchDefinitionState = async ({
  con,
  channel,
}: {
  con: DataSource;
  channel: string;
}): Promise<ChannelHighlightState | null> =>
  queryReadReplica(con, ({ queryRunner }) =>
    queryRunner.manager.getRepository(ChannelHighlightState).findOne({
      where: {
        channel,
      },
    }),
  );

const fetchCurrentHighlights = async ({
  con,
  channel,
}: {
  con: DataSource;
  channel: string;
}): Promise<PostHighlight[]> =>
  queryReadReplica(con, ({ queryRunner }) =>
    queryRunner.manager.getRepository(PostHighlight).find({
      where: {
        channel,
      },
      order: {
        rank: 'ASC',
      },
    }),
  );

const fetchPostsByIds = async ({
  con,
  ids,
  horizonStart,
}: {
  con: DataSource;
  ids: string[];
  horizonStart: Date;
}): Promise<HighlightPost[]> => {
  if (!ids.length) {
    return [];
  }

  return queryReadReplica(con, ({ queryRunner }) =>
    queryRunner.manager.getRepository(Post).find({
      where: {
        id: In(ids),
        createdAt: MoreThanOrEqual(horizonStart),
        visible: true,
        deleted: false,
        banned: false,
        showOnFeed: true,
      },
    }),
  ) as unknown as Promise<HighlightPost[]>;
};

const fetchIncrementalPosts = async ({
  con,
  channel,
  fetchStart,
  horizonStart,
}: {
  con: DataSource;
  channel: string;
  fetchStart: Date;
  horizonStart: Date;
}): Promise<HighlightPost[]> =>
  queryReadReplica(con, ({ queryRunner }) =>
    queryRunner.manager
      .getRepository(Post)
      .createQueryBuilder('post')
      .where('post.createdAt >= :horizonStart', { horizonStart })
      .andWhere('post.visible = true')
      .andWhere('post.deleted = false')
      .andWhere('post.banned = false')
      .andWhere('post.showOnFeed = true')
      .andWhere(`(post."contentMeta"->'channels') ? :channel`, { channel })
      .andWhere(
        new Brackets((builder) => {
          builder
            .where('post.createdAt >= :fetchStart', { fetchStart })
            .orWhere('post.metadataChangedAt >= :fetchStart', { fetchStart })
            .orWhere('post.statsUpdatedAt >= :fetchStart', { fetchStart });
        }),
      )
      .getMany(),
  ) as unknown as Promise<HighlightPost[]>;

const fetchRelations = async ({
  con,
  postIds,
}: {
  con: DataSource;
  postIds: string[];
}): Promise<PostRelation[]> => {
  if (!postIds.length) {
    return [];
  }

  return queryReadReplica(con, ({ queryRunner }) =>
    queryRunner.manager
      .getRepository(PostRelation)
      .createQueryBuilder('relation')
      .where('relation.type = :type', {
        type: PostRelationType.Collection,
      })
      .andWhere(
        new Brackets((builder) => {
          builder
            .where('relation.relatedPostId IN (:...postIds)', { postIds })
            .orWhere('relation.postId IN (:...postIds)', { postIds });
        }),
      )
      .getMany(),
  );
};

const mergePosts = (groups: HighlightPost[][]): HighlightPost[] => {
  const byId = new Map<string, HighlightPost>();
  for (const posts of groups) {
    for (const post of posts) {
      byId.set(post.id, post);
    }
  }

  return [...byId.values()];
};

const buildStories = ({
  posts,
  relations,
  previousPool,
  horizonStart,
  referenceTime,
}: {
  posts: HighlightPost[];
  relations: PostRelation[];
  previousPool: ChannelHighlightCandidatePool;
  horizonStart: Date;
  referenceTime: Date;
}): HighlightStory[] => {
  const postsById = new Map(posts.map((post) => [post.id, post]));
  const previousStories = new Map(
    previousPool.stories.map((story) => [story.storyKey, story]),
  );
  const collectionByChildId = new Map<string, string>();
  const collectionIds = new Set<string>();
  const relationActivityByCollectionId = new Map<string, Date>();

  for (const relation of relations) {
    if (
      !postsById.has(relation.postId) ||
      !postsById.has(relation.relatedPostId)
    ) {
      continue;
    }

    collectionIds.add(relation.postId);
    collectionByChildId.set(relation.relatedPostId, relation.postId);
    const currentActivity = relationActivityByCollectionId.get(relation.postId);
    if (!currentActivity || relation.createdAt > currentActivity) {
      relationActivityByCollectionId.set(relation.postId, relation.createdAt);
    }
  }

  const groupedStories = new Map<string, HighlightPost[]>();
  const storyCollections = new Map<string, string | null>();

  for (const post of posts) {
    const collectionId =
      collectionByChildId.get(post.id) ||
      (collectionIds.has(post.id) ? post.id : null);
    const canonicalPost =
      collectionId && postsById.has(collectionId)
        ? postsById.get(collectionId)!
        : post;
    const storyKey = getStoryKey({
      canonicalPost,
      collectionId,
    });

    if (!groupedStories.has(storyKey)) {
      groupedStories.set(storyKey, []);
      storyCollections.set(storyKey, collectionId);
    }

    groupedStories.get(storyKey)!.push(post);
  }

  return [...groupedStories.entries()]
    .map(([storyKey, memberPosts]) => {
      const collectionId = storyCollections.get(storyKey) || null;
      const canonicalPost =
        collectionId && postsById.has(collectionId)
          ? postsById.get(collectionId)!
          : selectCanonicalPost(memberPosts);
      const firstSeenAt = memberPosts.reduce(
        (current, post) =>
          post.createdAt < current ? post.createdAt : current,
        canonicalPost.createdAt,
      );
      const lastSeenAt = memberPosts.reduce((current, post) => {
        const lastActivityAt = toLastActivityAt(post);
        return lastActivityAt > current ? lastActivityAt : current;
      }, toLastActivityAt(canonicalPost));
      const relationActivityAt = collectionId
        ? relationActivityByCollectionId.get(collectionId)
        : null;
      const baseStory = {
        storyKey,
        canonicalPost,
        memberPosts,
        collectionId,
        firstSeenAt,
        lastSeenAt:
          relationActivityAt && relationActivityAt > lastSeenAt
            ? relationActivityAt
            : lastSeenAt,
        cached: previousStories.get(storyKey) || null,
      };

      return {
        ...baseStory,
        preliminaryScore: toPreliminaryScore({
          story: baseStory,
          horizonStart,
          referenceTime,
        }),
      };
    })
    .filter((story) => story.lastSeenAt >= horizonStart)
    .sort((left, right) => right.preliminaryScore - left.preliminaryScore);
};

const toStoryCandidate = (story: HighlightStory): HighlightStoryCandidate => ({
  storyKey: story.storyKey,
  canonicalPostId: story.canonicalPost.id,
  collectionId: story.collectionId,
  memberPostIds: story.memberPosts.map((post) => post.id).sort(),
  title: story.canonicalPost.title || '',
  summary: story.canonicalPost.summary || '',
  type: story.canonicalPost.type,
  sourceId: story.canonicalPost.sourceId,
  createdAt: story.canonicalPost.createdAt.toISOString(),
  lastActivityAt: story.lastSeenAt.toISOString(),
  upvotes: story.canonicalPost.upvotes,
  comments: story.canonicalPost.comments,
  views: story.canonicalPost.views,
  contentCuration: story.canonicalPost.contentCuration || [],
  quality: toQualitySummary(story.canonicalPost.contentQuality || {}),
  preliminaryScore: story.preliminaryScore,
});

const toBaselineStoryKey = ({
  postId,
  storiesByPostId,
}: {
  postId: string;
  storiesByPostId: Map<string, HighlightStory>;
}): string => storiesByPostId.get(postId)?.storyKey || `post:${postId}`;

const buildBaselineSnapshot = ({
  highlights,
  storiesByPostId,
}: {
  highlights: PostHighlight[];
  storiesByPostId: Map<string, HighlightStory>;
}): HighlightBaselineItem[] =>
  highlights.map((highlight) => ({
    postId: highlight.postId,
    rank: highlight.rank,
    headline: highlight.headline,
    storyKey: toBaselineStoryKey({
      postId: highlight.postId,
      storiesByPostId,
    }),
  }));

const arePostIdsEqual = (left: string[], right: string[]): boolean =>
  left.length === right.length &&
  left.every((postId, index) => postId === right[index]);

const hasCachedStoryChanged = (story: HighlightStory): boolean => {
  if (!story.cached) {
    return true;
  }

  const cachedMemberPostIds = [...story.cached.memberPostIds].sort();
  const storyMemberPostIds = story.memberPosts.map((post) => post.id).sort();

  return (
    story.cached.canonicalPostId !== story.canonicalPost.id ||
    !arePostIdsEqual(cachedMemberPostIds, storyMemberPostIds)
  );
};

const shouldReuseEvaluations = ({
  shortlist,
}: {
  shortlist: HighlightStory[];
}): boolean =>
  shortlist.length > 0 &&
  shortlist.every((story) => {
    if (
      !story.cached?.lastHeadline ||
      story.cached.lastSignificanceScore == null
    ) {
      return false;
    }

    if (!story.cached.lastLlmEvaluatedAt) {
      return false;
    }

    if (hasCachedStoryChanged(story)) {
      return false;
    }

    return (
      new Date(story.cached.lastLlmEvaluatedAt).getTime() >=
      story.lastSeenAt.getTime()
    );
  });

const reuseEvaluations = ({
  shortlist,
  maxItems,
}: {
  shortlist: HighlightStory[];
  maxItems: number;
}): EvaluatedHighlightItem[] =>
  shortlist.slice(0, maxItems).map((story, index) => ({
    storyKey: story.storyKey,
    postId: story.canonicalPost.id,
    headline: story.cached?.lastHeadline || story.canonicalPost.title || '',
    significanceScore: story.cached?.lastSignificanceScore || 0,
    significanceLabel: story.cached?.lastSignificanceLabel || 'routine',
    rank: index + 1,
    reason: 'Reused cached evaluation',
  }));

const toPoolStory = ({
  story,
  evaluation,
  evaluatedAt,
}: {
  story: HighlightStory;
  evaluation?: EvaluatedHighlightItem;
  evaluatedAt: Date;
}): StoredHighlightStory => ({
  storyKey: story.storyKey,
  canonicalPostId: story.canonicalPost.id,
  collectionId: story.collectionId,
  memberPostIds: story.memberPosts.map((post) => post.id).sort(),
  firstSeenAt: story.cached?.firstSeenAt || story.firstSeenAt.toISOString(),
  lastSeenAt: story.lastSeenAt.toISOString(),
  lastLlmEvaluatedAt: evaluation
    ? evaluatedAt.toISOString()
    : story.cached?.lastLlmEvaluatedAt || null,
  lastSignificanceScore:
    evaluation?.significanceScore ??
    story.cached?.lastSignificanceScore ??
    null,
  lastSignificanceLabel:
    evaluation?.significanceLabel ??
    story.cached?.lastSignificanceLabel ??
    null,
  lastHeadline: evaluation?.headline ?? story.cached?.lastHeadline ?? null,
  status: story.cached?.status || 'active',
});

const shouldPublish = ({
  baseline,
  internal,
}: {
  baseline: HighlightBaselineItem[];
  internal: EvaluatedHighlightItem[];
}): boolean => {
  if (!baseline.length) {
    return internal.length > 0;
  }

  if (!internal.length) {
    return false;
  }

  const toItemSignature = (item: {
    storyKey: string;
    rank: number;
    postId: string;
  }): string => `${item.storyKey}:${item.rank}:${item.postId}`;

  const baselineSignature = baseline.map(toItemSignature).join('|');
  const internalSignature = internal.map(toItemSignature).join('|');

  if (baselineSignature !== internalSignature) {
    return true;
  }

  const baselineHeadlines = baseline.map((item) => item.headline).join('|');
  const internalHeadlines = internal.map((item) => item.headline).join('|');
  return baselineHeadlines !== internalHeadlines;
};

const compareSnapshots = ({
  baseline,
  internal,
}: {
  baseline: HighlightBaselineItem[];
  internal: EvaluatedHighlightItem[];
}) => {
  const baselineByStory = new Map(
    baseline.map((item) => [item.storyKey, item]),
  );
  const internalByStory = new Map(
    internal.map((item) => [item.storyKey, item]),
  );
  const overlap = [...internalByStory.keys()].filter((storyKey) =>
    baselineByStory.has(storyKey),
  );

  return {
    baselineCount: baseline.length,
    internalCount: internal.length,
    overlapCount: overlap.length,
    addedStoryKeys: [...internalByStory.keys()].filter(
      (storyKey) => !baselineByStory.has(storyKey),
    ),
    removedStoryKeys: [...baselineByStory.keys()].filter(
      (storyKey) => !internalByStory.has(storyKey),
    ),
    churnCount:
      [...internalByStory.keys()].filter(
        (storyKey) => !baselineByStory.has(storyKey),
      ).length +
      [...baselineByStory.keys()].filter(
        (storyKey) => !internalByStory.has(storyKey),
      ).length,
  };
};

export const generateChannelHighlight = async ({
  con,
  definition,
  now = new Date(),
}: {
  con: DataSource;
  definition: ChannelHighlightDefinition;
  now?: Date;
}): Promise<GenerateChannelHighlightResult> => {
  const state = await fetchDefinitionState({
    con,
    channel: definition.channel,
  });
  const previousPool = parseCandidatePool(state?.candidatePool);
  const currentHighlights = await fetchCurrentHighlights({
    con,
    channel: definition.channel,
  });
  const horizonStart = getHorizonStart({
    now,
    definition,
  });
  const fetchStart = getFetchStart({
    now,
    definition,
    state,
  });
  const previousPoolPostIds = previousPool.stories.flatMap(
    (story) => story.memberPostIds,
  );
  const currentHighlightPostIds = currentHighlights.map((item) => item.postId);
  const retainedPosts = await fetchPostsByIds({
    con,
    ids: [...new Set([...previousPoolPostIds, ...currentHighlightPostIds])],
    horizonStart,
  });
  const incrementalPosts = await fetchIncrementalPosts({
    con,
    channel: definition.channel,
    fetchStart,
    horizonStart,
  });
  const basePosts = mergePosts([retainedPosts, incrementalPosts]);
  const baseRelations = await fetchRelations({
    con,
    postIds: basePosts.map((post) => post.id),
  });
  const relatedPostIds = [
    ...new Set(
      baseRelations.flatMap((relation) => [
        relation.postId,
        relation.relatedPostId,
      ]),
    ),
  ];
  const relationPosts = await fetchPostsByIds({
    con,
    ids: relatedPostIds,
    horizonStart,
  });
  const posts = mergePosts([basePosts, relationPosts]);
  const stories = buildStories({
    posts,
    relations: baseRelations,
    previousPool,
    horizonStart,
    referenceTime: now,
  });
  const storiesByPostId = new Map<string, HighlightStory>();
  for (const story of stories) {
    storiesByPostId.set(story.canonicalPost.id, story);
    for (const memberPost of story.memberPosts) {
      storiesByPostId.set(memberPost.id, story);
    }
  }

  const shortlist = stories.slice(
    0,
    definition.maxItems * SHORTLIST_MULTIPLIER,
  );
  const baselineSnapshot = buildBaselineSnapshot({
    highlights: currentHighlights,
    storiesByPostId,
  });
  const reusedEvaluations = shouldReuseEvaluations({
    shortlist,
  });

  const evaluatedItems = reusedEvaluations
    ? reuseEvaluations({
        shortlist,
        maxItems: definition.maxItems,
      })
    : (
        await evaluateChannelHighlights({
          channel: definition.channel,
          maxItems: definition.maxItems,
          currentHighlights: baselineSnapshot,
          candidates: shortlist.map(toStoryCandidate),
        })
      ).items;

  const candidatePool = {
    stories: stories.slice(0, MAX_CANDIDATE_POOL_STORIES).map((story) =>
      toPoolStory({
        story,
        evaluation: evaluatedItems.find(
          (item) => item.storyKey === story.storyKey,
        ),
        evaluatedAt: now,
      }),
    ),
  };
  const comparison = compareSnapshots({
    baseline: baselineSnapshot,
    internal: evaluatedItems,
  });
  const wouldPublish = shouldPublish({
    baseline: baselineSnapshot,
    internal: evaluatedItems,
  });
  const publish = definition.mode === 'publish' && wouldPublish;
  const metrics = {
    fetchedPosts: incrementalPosts.length,
    retainedPosts: retainedPosts.length,
    totalStories: stories.length,
    shortlistStories: shortlist.length,
    evaluatedStories: reusedEvaluations ? 0 : shortlist.length,
    reusedEvaluation: reusedEvaluations,
  };

  const runRepo = con.getRepository(ChannelHighlightRun);
  let run = runRepo.create({
    channel: definition.channel,
    scheduledAt: now,
    status: 'processing',
    baselineSnapshot,
    inputSummary: {
      fetchStart: fetchStart.toISOString(),
      horizonStart: horizonStart.toISOString(),
      shortlist: shortlist.map((story) => ({
        storyKey: story.storyKey,
        canonicalPostId: story.canonicalPost.id,
        preliminaryScore: story.preliminaryScore,
      })),
    },
    internalSnapshot: [],
    comparison: {},
    metrics,
  });
  run = await runRepo.save(run);

  try {
    await con.transaction(async (manager) => {
      await manager.getRepository(ChannelHighlightState).save({
        channel: definition.channel,
        lastFetchedAt: now,
        lastPublishedAt: publish ? now : state?.lastPublishedAt || null,
        candidatePool,
      });

      if (publish) {
        await replaceHighlightsForChannel({
          manager,
          channel: definition.channel,
          items: evaluatedItems.map((item) => ({
            postId: item.postId,
            rank: item.rank,
            headline: item.headline,
          })),
        });
      }

      await manager.getRepository(ChannelHighlightRun).update(
        {
          id: run.id,
        },
        {
          status: 'completed',
          completedAt: new Date(),
          internalSnapshot: evaluatedItems,
          comparison: {
            ...comparison,
            wouldPublish,
            published: publish,
          },
          metrics,
        },
      );
    });

    const completedRun = await runRepo.findOneByOrFail({
      id: run.id,
    });

    return {
      run: completedRun,
      published: publish,
    };
  } catch (err) {
    baseLogger.error(
      { err, channel: definition.channel },
      'Failed channel highlight run',
    );
    await runRepo.update(
      {
        id: run.id,
      },
      {
        status: 'failed',
        completedAt: new Date(),
        error: {
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      },
    );
    throw err;
  }
};
