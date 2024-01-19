import { getPermissionsForMember } from './../schema/sources';
import { GraphORM, QueryBuilder } from './graphorm';
import {
  Bookmark,
  CommentUpvote,
  FeedSource,
  FeedTag,
  Post,
  Source,
  SourceMember,
  User,
  UserPost,
} from '../entity';
import {
  SourceMemberRoles,
  rankToSourceRole,
  sourceRoleRank,
  sourceRoleRankKeys,
} from '../roles';

import { Context } from '../Context';
import { GQLBookmarkList } from '../schema/bookmarks';
import { base64 } from '../common';
import { GQLComment } from '../schema/comments';
import { GQLUserPost } from '../schema/posts';
import { UserNotification } from '../entity/notifications/UserNotification';

const existsByUserAndPost =
  (entity: string, build?: (queryBuilder: QueryBuilder) => QueryBuilder) =>
  (ctx: Context, alias: string, qb: QueryBuilder): string => {
    let query = qb
      .select('1')
      .from(entity, 'a')
      .where(`a."userId" = :userId`, { userId: ctx.userId })
      .andWhere(`a."postId" = ${alias}.id`);

    if (typeof build === 'function') {
      query = build(query);
    }

    return `EXISTS${query.getQuery()}`;
  };

const nullIfNotLoggedIn = <T>(value: T, ctx: Context): T | null =>
  ctx.userId ? value : null;

const nullIfNotSameUser = <T>(
  value: T,
  ctx: Context,
  parent: Pick<User, 'id'>,
): T | null => (ctx.userId === parent.id ? value : null);

const obj = new GraphORM({
  User: {
    requiredColumns: ['id', 'username', 'createdAt'],
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
  Post: {
    additionalQuery: (ctx, alias, qb) =>
      qb
        .andWhere(`"${alias}"."deleted" = false`)
        .andWhere(`"${alias}"."visible" = true`),
    requiredColumns: [
      'id',
      'shortId',
      'createdAt',
      'pinnedAt',
      'authorId',
      'scoutId',
      'private',
      'type',
    ],
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
        select: existsByUserAndPost('UserPost', (qb) =>
          qb.andWhere(`${qb.alias}.vote = 1`),
        ),
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
      downvoted: {
        select: existsByUserAndPost('UserPost', (qb) =>
          qb.andWhere(`${qb.alias}.vote = -1`),
        ),
        transform: nullIfNotLoggedIn,
      },
      flags: {
        jsonType: true,
      },
      userState: {
        relation: {
          isMany: false,
          customRelation: (ctx, parentAlias, childAlias, qb): QueryBuilder => {
            return qb
              .where(`${childAlias}."userId" = :userId`, { userId: ctx.userId })
              .andWhere(`${childAlias}."postId" = "${parentAlias}".id`);
          },
        },
        transform: (value: GQLUserPost, ctx: Context) => {
          if (!ctx.userId) {
            return null;
          }

          if (!value) {
            return ctx.con.getRepository(UserPost).create();
          }

          return value;
        },
      },
      updatedAt: {
        select: 'metadataChangedAt',
      },
      collectionSources: {
        relation: {
          isMany: true,
          customRelation: (ctx, parentAlias, childAlias, qb): QueryBuilder => {
            return qb
              .where(
                `${childAlias}.id = ANY(${parentAlias}."collectionSources")`,
              )
              .limit(3);
          },
        },
      },
      numCollectionSources: {
        select: 'collectionSources',
        transform: (value: string[]): number => value?.length ?? 0,
      },
    },
  },
  Source: {
    requiredColumns: ['id', 'private', 'handle', 'type'],
    fields: {
      public: {
        select: 'private',
        transform: (value: boolean): boolean => !value,
      },
      members: {
        relation: {
          isMany: true,
          order: 'DESC',
          sort: 'createdAt',
          customRelation: (ctx, parentAlias, childAlias, qb): QueryBuilder =>
            qb
              .where(`${childAlias}."sourceId" = "${parentAlias}".id`)
              .andWhere(`${childAlias}."role" != :role`, {
                role: SourceMemberRoles.Blocked,
              }),
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
            .where(`sm."sourceId" = ${alias}.id`)
            .andWhere(`sm."role" != '${SourceMemberRoles.Blocked}'`),
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
      privilegedMembers: {
        relation: {
          isMany: true,
          customRelation: (ctx, parentAlias, childAlias, qb): QueryBuilder => {
            return qb
              .where(`${childAlias}."sourceId" = "${parentAlias}".id`)
              .andWhere(`${childAlias}.role IN (:...roles)`, {
                roles: [SourceMemberRoles.Admin, SourceMemberRoles.Moderator],
              })
              .limit(50); // limit to avoid huge arrays for members, most sources should fit into this see PR !1219 for more info
          },
        },
        transform: nullIfNotLoggedIn,
      },
      memberPostingRole: {
        select: 'memberPostingRank',
        transform: (value: number, ctx: Context) =>
          nullIfNotLoggedIn(rankToSourceRole[value], ctx),
      },
      memberInviteRole: {
        select: 'memberInviteRank',
        transform: (value: number, ctx: Context) =>
          nullIfNotLoggedIn(rankToSourceRole[value], ctx),
      },
    },
  },
  SourceMember: {
    requiredColumns: ['createdAt', 'userId', 'role'],
    fields: {
      permissions: {
        select: (ctx: Context, alias: string, qb: QueryBuilder): string => {
          const query = qb
            .select('array["memberPostingRank", "memberInviteRank"]')
            .from(Source, 'postingSquad')
            .where(`postingSquad.id = ${alias}."sourceId"`);
          return `${query.getQuery()}`;
        },
        transform: (
          value: [number, number],
          ctx: Context,
          member: SourceMember,
        ) => {
          if (!ctx.userId || member.userId !== ctx.userId) {
            return null;
          }

          const [memberPostingRank, memberInviteRank] = value;

          return getPermissionsForMember(member, {
            memberPostingRank,
            memberInviteRank,
          });
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
      referralToken: {
        transform: (value: string, ctx: Context, member: SourceMember) => {
          return nullIfNotSameUser(value, ctx, { id: member.userId });
        },
      },
      flags: {
        jsonType: true,
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
    from: 'NotificationV2',
    additionalQuery: (ctx, alias, qb) =>
      qb
        .innerJoin(
          UserNotification,
          'un',
          `"${alias}".id = un."notificationId"`,
        )
        .addSelect('un."readAt"'),
    fields: {
      avatars: {
        relation: {
          isMany: true,
          customRelation: (ctx, parentAlias, childAlias, qb): QueryBuilder => {
            return qb
              .where(`"${childAlias}".id = any("${parentAlias}".avatars)`)
              .orderBy(
                `array_position("${parentAlias}".avatars, "${childAlias}".id)`,
              );
          },
        },
      },
      attachments: {
        relation: {
          isMany: true,
          customRelation: (ctx, parentAlias, childAlias, qb): QueryBuilder => {
            return qb
              .where(`"${childAlias}".id = any("${parentAlias}".attachments)`)
              .orderBy(
                `array_position("${parentAlias}".attachments, "${childAlias}".id)`,
              );
          },
        },
      },
    },
  },
  NotificationAttachment: {
    from: 'NotificationAttachmentV2',
  },
  NotificationAvatar: {
    from: 'NotificationAvatarV2',
  },
  UserPost: {
    requiredColumns: ['votedAt'],
    fields: {
      flags: {
        jsonType: true,
      },
    },
  },
  PostQuestion: {
    requiredColumns: ['id'],
  },
  UserPersonalizedDigest: {
    requiredColumns: ['userId'],
  },
  Keyword: {
    fields: {
      flags: {
        jsonType: true,
      },
    },
  },
});

export default obj;
