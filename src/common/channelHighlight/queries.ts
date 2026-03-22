import { Brackets, In, IsNull, type DataSource } from 'typeorm';
import { ONE_HOUR_IN_SECONDS } from '../constants';
import { PostHighlight } from '../../entity/PostHighlight';
import { Post } from '../../entity/posts/Post';
import {
  PostRelation,
  PostRelationType,
} from '../../entity/posts/PostRelation';
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

export const fetchCurrentHighlights = async ({
  con,
  channel,
}: {
  con: DataSource;
  channel: string;
}): Promise<PostHighlight[]> =>
  con.getRepository(PostHighlight).find({
    where: {
      channel,
      retiredAt: IsNull(),
    },
    order: {
      highlightedAt: 'DESC',
    },
  });

export const fetchPostsByIds = async ({
  con,
  ids,
}: {
  con: DataSource;
  ids: string[];
}): Promise<HighlightPost[]> => {
  if (!ids.length) {
    return [];
  }

  return con.getRepository(Post).find({
    where: {
      id: In(ids),
      visible: true,
      deleted: false,
      banned: false,
    },
  }) as unknown as Promise<HighlightPost[]>;
};

export const fetchIncrementalPosts = async ({
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
  con
    .getRepository(Post)
    .createQueryBuilder('post')
    .where('post.createdAt >= :horizonStart', { horizonStart })
    .andWhere('post.visible = true')
    .andWhere('post.deleted = false')
    .andWhere('post.banned = false')
    .andWhere('post.showOnFeed = true')
    .andWhere('post.sharedPostId IS NULL')
    .andWhere(`(post."contentMeta"->'channels') ? :channel`, { channel })
    .andWhere(`NOT (post."contentCuration" && :rejectedCurations)`, {
      rejectedCurations: REJECTED_CONTENT_CURATIONS,
    })
    .andWhere(
      new Brackets((builder) => {
        builder
          .where('post.createdAt >= :fetchStart', { fetchStart })
          .orWhere('post.metadataChangedAt >= :fetchStart', { fetchStart })
          .orWhere('post.statsUpdatedAt >= :fetchStart', { fetchStart });
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

export const mergePosts = (groups: HighlightPost[][]): HighlightPost[] => {
  const byId = new Map<string, HighlightPost>();
  for (const posts of groups) {
    for (const post of posts) {
      byId.set(post.id, post);
    }
  }

  return [...byId.values()];
};
