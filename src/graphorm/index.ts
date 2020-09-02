import { GraphORM, QueryBuilder } from './graphorm';
import { Bookmark } from '../entity';
import { Context } from '../Context';
import { GQLBookmarkList } from '../schema/bookmarks';

const existsByUserAndPost = (entity: string) => (
  ctx: Context,
  alias: string,
  qb: QueryBuilder,
): QueryBuilder =>
  qb
    .select('count(*) > 0')
    .from(entity, 'a')
    .where(`a."userId" = :userId`, { userId: ctx.userId })
    .andWhere(`a."postId" = ${alias}.id`)
    .limit(1);

const nullIfNotLoggedIn = <T>(value: T, ctx: Context): T | null =>
  ctx.userId ? value : null;

const obj = new GraphORM({
  Post: {
    requiredColumns: ['id', 'shortId', 'createdAt'],
    fields: {
      source: {
        customQuery: (ctx, alias, qb): QueryBuilder => {
          const selectByUserId = ctx.userId
            ? `"${alias}"."userId" = :userId OR `
            : '';
          return qb.andWhere(`(${selectByUserId}"${alias}"."userId" IS NULL)`, {
            userId: ctx.userId,
          }).orderBy(`"${alias}"."userId"`, 'DESC', 'NULLS LAST');
        },
        relation: {
          parentColumn: 'sourceId',
          childColumn: 'sourceId',
          isMany: false,
        },
      },
      tags: {
        select: '"tagsStr"',
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
      id: { select: '"sourceId"' },
      public: { select: '"userId" IS NULL' },
    },
  },
  Comment: {
    requiredColumns: ['id', 'postId'],
  }
});

export default obj;
