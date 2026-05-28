import { Brackets, In, Not, type DataSource } from 'typeorm';
import { ONE_HOUR_IN_SECONDS, ONE_WEEK_IN_SECONDS } from '../constants';
import { HighlightsCanonical } from '../../entity/HighlightsCanonical';
import { Post } from '../../entity/posts/Post';
import {
  PostRelation,
  PostRelationType,
} from '../../entity/posts/PostRelation';
import { SharePost } from '../../entity/posts/SharePost';
import type { ChannelHighlightDefinition } from '../../entity/ChannelHighlightDefinition';
import type { HighlightPost } from './types';

const REJECTED_CONTENT_CURATIONS = [
  'tutorial',
  'listicle',
  'comparison',
  'endorsement',
  'hot_take',
  'opinion',
  'product',
];

const HIGHLIGHT_FETCH_OVERLAP_SECONDS = 10 * 60;
const HIGHLIGHT_EVALUATION_HISTORY_SECONDS = 2 * ONE_WEEK_IN_SECONDS;

export const getHorizonStart = ({
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

export const getFetchStart = ({
  now,
  definition,
}: {
  now: Date;
  definition: Pick<
    ChannelHighlightDefinition,
    'candidateHorizonHours' | 'lastFetchedAt'
  >;
}): Date => {
  const horizonStart = getHorizonStart({
    now,
    definition,
  });

  if (!definition.lastFetchedAt) {
    return horizonStart;
  }

  const overlapStart = new Date(
    definition.lastFetchedAt.getTime() - HIGHLIGHT_FETCH_OVERLAP_SECONDS * 1000,
  );

  return overlapStart > horizonStart ? overlapStart : horizonStart;
};

export const getEvaluationHistoryStart = ({ now }: { now: Date }): Date =>
  new Date(now.getTime() - HIGHLIGHT_EVALUATION_HISTORY_SECONDS * 1000);

export const fetchEvaluationHistoryCanonicalHighlights = async ({
  con,
  now,
}: {
  con: DataSource;
  now: Date;
}): Promise<HighlightsCanonical[]> => {
  return con
    .getRepository(HighlightsCanonical)
    .createQueryBuilder('highlight')
    .where('highlight.highlightedAt >= :historyStart', {
      historyStart: getEvaluationHistoryStart({
        now,
      }),
    })
    .orderBy('highlight.highlightedAt', 'DESC')
    .getMany();
};

export const fetchPostsByIds = async ({
  con,
  ids,
  excludedSourceIds = [],
}: {
  con: DataSource;
  ids: string[];
  excludedSourceIds?: string[];
}): Promise<HighlightPost[]> => {
  if (!ids.length) {
    return [];
  }

  return con.getRepository(Post).find({
    where: {
      id: In(ids),
      sourceId: excludedSourceIds.length
        ? Not(In(excludedSourceIds))
        : undefined,
      visible: true,
      deleted: false,
      banned: false,
    },
  }) as unknown as Promise<HighlightPost[]>;
};

export const fetchIncrementalPosts = async ({
  con,
  fetchStart,
  horizonStart,
  excludedSourceIds = [],
}: {
  con: DataSource;
  fetchStart: Date;
  horizonStart: Date;
  excludedSourceIds?: string[];
}): Promise<HighlightPost[]> =>
  con
    .getRepository(Post)
    .createQueryBuilder('post')
    .where('post.createdAt >= :horizonStart', { horizonStart })
    .andWhere('post.visible = true')
    .andWhere('post.deleted = false')
    .andWhere('post.banned = false')
    .andWhere('post.showOnFeed = true')
    .andWhere('post.sharedPostId IS NULL')
    .andWhere(`NOT (post."contentCuration" && :rejectedCurations)`, {
      rejectedCurations: REJECTED_CONTENT_CURATIONS,
    })
    .andWhere(
      excludedSourceIds.length
        ? 'post."sourceId" NOT IN (:...excludedSourceIds)'
        : '1=1',
      { excludedSourceIds },
    )
    .andWhere(
      new Brackets((builder) => {
        builder
          .where('post.createdAt >= :fetchStart', { fetchStart })
          .orWhere('post.metadataChangedAt >= :fetchStart', { fetchStart });
      }),
    )
    .getMany() as unknown as Promise<HighlightPost[]>;

export const fetchRelations = async ({
  con,
  postIds,
}: {
  con: DataSource;
  postIds: string[];
}): Promise<PostRelation[]> => {
  if (!postIds.length) {
    return [];
  }

  return con
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
    .getMany();
};

export const fetchPublicShareFallbackPostIds = async ({
  con,
  sharedPostIds,
  excludedSourceIds = [],
}: {
  con: DataSource;
  sharedPostIds: string[];
  excludedSourceIds?: string[];
}): Promise<Map<string, string>> => {
  if (!sharedPostIds.length) {
    return new Map();
  }

  const shares = await con
    .getRepository(SharePost)
    .createQueryBuilder('post')
    .select(['post.id', 'post.sharedPostId'])
    .where('post."sharedPostId" IN (:...sharedPostIds)', {
      sharedPostIds,
    })
    .andWhere('post.visible = true')
    .andWhere('post.deleted = false')
    .andWhere('post.banned = false')
    .andWhere('post.private = false')
    .andWhere('post.showOnFeed = true')
    .andWhere(
      excludedSourceIds.length
        ? 'post."sourceId" NOT IN (:...excludedSourceIds)'
        : '1=1',
      { excludedSourceIds },
    )
    .orderBy('post.upvotes', 'DESC')
    .addOrderBy('post."createdAt"', 'DESC')
    .addOrderBy('post.id', 'DESC')
    .getMany();
  const fallbackPostIds = new Map<string, string>();

  for (const share of shares) {
    if (fallbackPostIds.has(share.sharedPostId)) {
      continue;
    }

    fallbackPostIds.set(share.sharedPostId, share.id);
  }

  return fallbackPostIds;
};

export const fetchCollectionMembership = async ({
  con,
  postIds,
}: {
  con: DataSource;
  postIds: string[];
}): Promise<{
  collectionByChild: Map<string, string>;
  childrenByCollection: Map<string, string[]>;
}> => {
  const collectionByChild = new Map<string, string>();
  const childrenByCollection = new Map<string, string[]>();

  if (!postIds.length) {
    return { collectionByChild, childrenByCollection };
  }

  const directRelations = await con
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
    .getMany();

  const collectionIds = new Set<string>();
  for (const relation of directRelations) {
    if (postIds.includes(relation.relatedPostId)) {
      collectionByChild.set(relation.relatedPostId, relation.postId);
      collectionIds.add(relation.postId);
    }
    if (postIds.includes(relation.postId)) {
      collectionIds.add(relation.postId);
    }
  }

  if (!collectionIds.size) {
    return { collectionByChild, childrenByCollection };
  }

  const siblingRelations = await con
    .getRepository(PostRelation)
    .createQueryBuilder('relation')
    .where('relation.type = :type', {
      type: PostRelationType.Collection,
    })
    .andWhere('relation.postId IN (:...collectionIds)', {
      collectionIds: [...collectionIds],
    })
    .getMany();

  for (const relation of siblingRelations) {
    const children = childrenByCollection.get(relation.postId) || [];
    children.push(relation.relatedPostId);
    childrenByCollection.set(relation.postId, children);
  }

  return { collectionByChild, childrenByCollection };
};

export const mergePosts = (groups: HighlightPost[][]): HighlightPost[] => {
  const byId = new Map<string, HighlightPost>();
  for (const posts of groups) {
    for (const post of posts) {
      byId.set(post.id, post);
    }
  }

  return [...byId.values()];
};
