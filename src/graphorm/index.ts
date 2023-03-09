import { roleSourcePermissions } from './../schema/sources';
import { GraphORM, QueryBuilder } from './graphorm';
import {
  Bookmark,
  CommentUpvote,
  FeedSource,
  FeedTag,
  Post,
  SourceMember,
  User,
} from '../entity';
import { sourceRoleRank, sourceRoleRankKeys } from '../roles';

import { Context } from '../Context';
import { GQLBookmarkList } from '../schema/bookmarks';
import { base64 } from '../common';
import { GQLComment } from '../schema/comments';

const existsByUserAndPost =
  (entity: string) =>
  (ctx: Context, alias: string, qb: QueryBuilder): string => {
    const query = qb
      .select('1')
      .from(entity, 'a')
      .where(`a."userId" = :userId`, { userId: ctx.userId })
      .andWhere(`a."postId" = ${alias}.id`);
    return `EXISTS${query.getQuery()}`;
  };

const nullIfNotLoggedIn = <T>(value: T, ctx: Context): T | null =>
  ctx.userId ? value : null;

const nullIfNotSameUser = <T>(value: T, ctx: Context, parent: User): T | null =>
  ctx.userId === parent.id ? value : null;

const obj = new GraphORM({
  User: {
    requiredColumns: ['id', 'username'],
    fields: {
      infoConfirmed: {
        transform: nullIfNotSameUser,
      },
      email: {
        transform: nullIfNotSameUser,
      },
      timezone: {
        transform: nullIfNotSameUser,
      },
      acceptedMarketing: {
        transform: nullIfNotSameUser,
      },
      notificationEmail: {
        transform: nullIfNotSameUser,
      },
    },
  },
  CommentUpvote: {
    requiredColumns: ['createdAt'],
  },
  Upvote: {
    requiredColumns: ['createdAt'],
  },
  Post: {
    from: 'ActivePost',
    metadataFrom: 'Post',
    requiredColumns: ['id', 'shortId', 'createdAt', 'authorId', 'scoutId'],
    fields: {
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
        transform: (value: number, ctx, parent: Post): number | null => {
          const isAuthor = parent?.authorId && ctx.userId === parent.authorId;

          if (isAuthor) {
            return value;
          }

          const isScout = parent?.scoutId && ctx.userId === parent.scoutId;
          if (isScout) {
            return value;
          }

          return null;
        },
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
          qb.distinctOn([`"userId"`]).andWhere(`"${alias}".featured is true`),
      },
      publication: {
        alias: { field: 'source', type: 'Source' },
      },
      toc: {
        jsonType: true,
      },
      sharedPost: {
        relation: {
          isMany: false,
          childColumn: 'id',
          parentColumn: 'sharedPostId',
        },
      },
    },
  },
  Source: {
    requiredColumns: ['id', 'private', 'handle', 'type'],
    fields: {
      public: {
        transform: (value: boolean): boolean => !value,
      },
      members: {
        relation: {
          isMany: true,
          childColumn: 'sourceId',
          parentColumn: 'id',
          order: 'DESC',
          sort: 'createdAt',
        },
        pagination: {
          limit: 50,
          hasNextPage: (size): boolean => size === 50,
          hasPreviousPage: (): boolean => false,
          nodeToCursor: (node: GQLComment): string =>
            base64(`time:${new Date(node.createdAt).getTime()}`),
        },
      },
      membersCount: {
        select: (ctx, alias, qb) =>
          qb
            .select('count(*)')
            .from(SourceMember, 'sm')
            .where(`sm."sourceId" = ${alias}.id`),
      },
      currentMember: {
        relation: {
          isMany: false,
          customRelation: (ctx, parentAlias, childAlias, qb): QueryBuilder =>
            qb
              .where(`${childAlias}."userId" = :userId`, { userId: ctx.userId })
              .andWhere(`${childAlias}."sourceId" = "${parentAlias}".id`),
        },
      },
    },
  },
  SourceMember: {
    requiredColumns: ['createdAt', 'userId'],
    fields: {
      permissions: {
        transform: (_, ctx: Context, member: SourceMember) => {
          if (!ctx.userId || member.userId !== ctx.userId) {
            return null;
          }

          return (
            roleSourcePermissions[member.role] ?? roleSourcePermissions.member
          );
        },
      },
      roleRank: {
        rawSelect: true,
        select: `
            (CASE
              ${sourceRoleRankKeys
                .map(
                  (role) =>
                    `WHEN "role" = '${role}' THEN ${sourceRoleRank[role]}`,
                )
                .join(' ')}
            ELSE 0 END)
          `,
      },
    },
  },
  Comment: {
    requiredColumns: ['id', 'postId', 'createdAt'],
    fields: {
      createdAt: {
        transform: (value: string | Date): Date => new Date(value),
      },
      lastUpdatedAt: {
        transform: (value?: string | Date): Date =>
          value ? new Date(value) : undefined,
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
          order: 'ASC',
          sort: 'createdAt',
        },
        pagination: {
          limit: 50,
          hasNextPage: (size): boolean => size === 50,
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
            .where(`ft."feedId" = "${alias}".id`)
            .andWhere('ft.blocked = false'),
        transform: (value: string): string[] => value?.split(',') ?? [],
      },
      blockedTags: {
        select: (ctx, alias, qb): QueryBuilder =>
          qb
            .select(`string_agg(tag, ',' order by tag)`)
            .from(FeedTag, 'ft')
            .where(`ft."feedId" = "${alias}".id`)
            .andWhere('ft.blocked = true'),
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
                `"${childAlias}"."id" = fs."sourceId"`,
              )
              .where(`fs."feedId" = "${parentAlias}".id`)
              .orderBy(`"${childAlias}".name`),
        },
      },
    },
  },
  FeedAdvancedSettings: {
    fields: {
      id: { alias: { field: 'advancedSettingsId', type: 'int' } },
    },
  },
  ReadingHistory: {
    from: 'ActiveView',
    metadataFrom: 'View',
  },
  Notification: {
    fields: {
      avatars: {
        relation: {
          isMany: true,
          sort: 'order',
          childColumn: 'notificationId',
          parentColumn: 'id',
        },
      },
      attachments: {
        relation: {
          isMany: true,
          sort: 'order',
          childColumn: 'notificationId',
          parentColumn: 'id',
        },
      },
    },
  },
});

export default obj;
