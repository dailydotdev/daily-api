import { GraphORM, QueryBuilder } from './graphorm';
import { Bookmark, CommentUpvote, FeedSource, FeedTag, Post } from '../entity';
import { Context } from '../Context';
import { GQLBookmarkList } from '../schema/bookmarks';
import { base64 } from '../common';
import { GQLComment } from '../schema/comments';

const existsByUserAndPost = (entity: string) => (
  ctx: Context,
  alias: string,
  qb: QueryBuilder,
): string => {
  const query = qb
    .select('1')
    .from(entity, 'a')
    .where(`a."userId" = :userId`, { userId: ctx.userId })
    .andWhere(`a."postId" = ${alias}.id`);
  return `EXISTS${query.getQuery()}`;
};

const nullIfNotLoggedIn = <T>(value: T, ctx: Context): T | null =>
  ctx.userId ? value : null;

const obj = new GraphORM({
  User: {
    requiredColumns: ['id', 'username'],
  },
  Post: {
    requiredColumns: ['id', 'shortId', 'createdAt', 'authorId'],
    fields: {
      source: {
        customQuery: (ctx, alias, qb): QueryBuilder => {
          const selectByUserId = ctx.userId
            ? `"${alias}"."userId" = :userId OR `
            : '';
          return qb.andWhere(`(${selectByUserId}"${alias}"."userId" IS NULL)`, {
            userId: ctx.userId,
          });
        },
        relation: {
          parentColumn: 'sourceId',
          childColumn: 'sourceId',
          isMany: false,
        },
      },
      tags: {
        select: 'tagsStr',
        transform: (value: string): string[] => value?.split(',') ?? [],
      },
      read: {
        select: existsByUserAndPost('View'),
        transform: nullIfNotLoggedIn,
      },
      bookmarked: {
        select: existsByUserAndPost('Bookmark'),
        transform: nullIfNotLoggedIn,
      },
      upvoted: {
        select: existsByUserAndPost('Upvote'),
        transform: nullIfNotLoggedIn,
      },
      commented: {
        select: existsByUserAndPost('Comment'),
        transform: nullIfNotLoggedIn,
      },
      views: {
        transform: (value: number, ctx, parent: Post): number | null =>
          parent?.authorId && ctx.userId === parent.authorId ? value : null,
      },
      bookmarkList: {
        relation: {
          isMany: false,
          customRelation: (ctx, parentAlias, childAlias, qb): QueryBuilder =>
            qb
              .innerJoin(
                Bookmark,
                'bookmark',
                `${childAlias}.id = bookmark."listId"`,
              )
              .where(`bookmark."postId" = ${parentAlias}.id`)
              .andWhere('bookmark."userId" = :userId', { userId: ctx.userId }),
        },
        transform: (value, ctx): GQLBookmarkList | null =>
          ctx.premium ? value : null,
      },
      numUpvotes: {
        select: 'upvotes',
      },
      numComments: {
        select: 'comments',
      },
      featuredComments: {
        customQuery: (ctx, alias, qb): QueryBuilder =>
          qb.andWhere(`"${alias}".featured is true`),
      },
      publication: {
        alias: { field: 'source', type: 'Source' },
      },
    },
  },
  Source: {
    from: 'SourceDisplay',
    fields: {
      id: { select: 'sourceId' },
      public: {
        select: 'userId',
        transform: (value: string): boolean => !value,
      },
    },
  },
  Comment: {
    requiredColumns: ['id', 'postId', 'createdAt'],
    fields: {
      createdAt: {
        transform: (value: string | Date): Date => new Date(value),
      },
      upvoted: {
        select: (ctx: Context, alias: string, qb: QueryBuilder): string => {
          const query = qb
            .select('1')
            .from(CommentUpvote, 'cu')
            .where(`cu."userId" = :userId`, { userId: ctx.userId })
            .andWhere(`cu."commentId" = ${alias}.id`);
          return `EXISTS${query.getQuery()}`;
        },
        transform: nullIfNotLoggedIn,
      },
      numUpvotes: {
        select: 'upvotes',
      },
      children: {
        relation: {
          isMany: true,
          childColumn: 'parentId',
          parentColumn: 'id',
        },
        pagination: {
          order: 'ASC',
          sort: 'createdAt',
          limit: 15,
          hasNextPage: (size): boolean => size === 15,
          hasPreviousPage: (): boolean => false,
          nodeToCursor: (node: GQLComment): string =>
            base64(`time:${new Date(node.createdAt).getTime()}`),
        },
      },
    },
  },
  FeedSettings: {
    from: 'Feed',
    fields: {
      includeTags: {
        select: (ctx, alias, qb): QueryBuilder =>
          qb
            .select(`string_agg(tag, ',' order by tag)`)
            .from(FeedTag, 'ft')
            .where(`ft."feedId" = "${alias}".id`),
        transform: (value: string): string[] => value?.split(',') ?? [],
      },
      excludeSources: {
        relation: {
          isMany: true,
          customRelation: (ctx, parentAlias, childAlias, qb): QueryBuilder =>
            qb
              .innerJoin(
                FeedSource,
                'fs',
                `"${childAlias}"."sourceId" = fs."sourceId"`,
              )
              .where(`fs."feedId" = "${parentAlias}".id`)
              .orderBy(`"${childAlias}".name`),
        },
      },
    },
  },
});

export default obj;
