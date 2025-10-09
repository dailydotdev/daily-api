import { getPermissionsForMember } from '../schema/sources';
import { GraphORM, GraphORMField, QueryBuilder } from './graphorm';
import {
  Bookmark,
  Source,
  SourceMember,
  User,
  UserPost,
  UserNotification,
  SourceFlagsPublic,
  defaultPublicSourceFlags,
  UserPersonalizedDigestFlagsPublic,
  UserPersonalizedDigestSendType,
  Feature,
  FeatureType,
  SettingsFlagsPublic,
  UserStats,
  UserSubscriptionFlags,
  type PostTranslation,
  PostType,
  type PostFlagsPublic,
  type Campaign,
  type OrganizationLink,
} from '../entity';
import {
  OrganizationMemberRole,
  SourceMemberRoles,
  rankToSourceRole,
  sourceRoleRank,
  sourceRoleRankKeys,
} from '../roles';

import { Context } from '../Context';
import {
  base64,
  domainOnly,
  getSmartTitle,
  getTranslationRecord,
  transformDate,
} from '../common';
import { GQLComment } from '../schema/comments';
import { GQLUserPost } from '../schema/posts';
import { UserComment } from '../entity/user/UserComment';
import { type ContentLanguage, type I18nRecord, UserVote } from '../types';
import { whereVordrFilter } from '../common/vordr';
import { UserCompany, Post } from '../entity';
import {
  ContentPreferenceStatus,
  ContentPreferenceType,
} from '../entity/contentPreference/types';
import { transformSettingFlags } from '../common/flags';
import { ContentPreferenceSource } from '../entity/contentPreference/ContentPreferenceSource';
import { ContentPreference } from '../entity/contentPreference/ContentPreference';
import { isPlusMember } from '../paddle';
import { remoteConfig } from '../remoteConfig';
import { whereNotUserBlocked } from '../common/contentPreference';
import { type GetBalanceResult } from '../common/njord';
import {
  ContentPreferenceOrganization,
  ContentPreferenceOrganizationStatus,
} from '../entity/contentPreference/ContentPreferenceOrganization';
import { OpportunityUserRecruiter } from '../entity/opportunities/user';
import { OpportunityUserType } from '../entity/opportunities/types';
import { OrganizationLinkType } from '../common/schema/organizations';
import type { GCSBlob } from '../common/schema/userCandidate';

const existsByUserAndPost =
  (entity: string, build?: (queryBuilder: QueryBuilder) => QueryBuilder) =>
  (ctx: Context, alias: string, qb: QueryBuilder): string => {
    let query = qb
      .select('1')
      .from(entity, 'a')
      .where(`a."userId" = :userId`, { userId: ctx.userId })
      .andWhere(`a."postId" = ${alias}.id`)
      .limit(1);

    if (typeof build === 'function') {
      query = build(query);
    }

    return /*sql*/ `CASE
      WHEN
        ${query.getQuery()}
        IS NOT NULL
      THEN
        TRUE
      ELSE
        FALSE
    END`;
  };

const nullIfNotLoggedIn = <T>(value: T, ctx: Context): T | null =>
  ctx.userId ? value : null;

const nullIfNotSameUser = <T>(
  value: T,
  ctx: Context,
  parent: unknown,
): T | null => {
  const user = parent as Pick<User, 'id'>;

  return ctx.userId === user.id ? value : null;
};

const checkIfTitleIsClickbait = (value?: string): boolean => {
  if (!value) {
    return false;
  }

  const clickbaitProbability = parseFloat(value || '0');
  const threshold = remoteConfig.vars.clickbaitTitleProbabilityThreshold || 1;

  return clickbaitProbability > threshold;
};

const createSmartTitleField = ({ field }: { field: string }): GraphORMField => {
  return {
    select: field,
    transform: async (value: string, ctx: Context, parent) => {
      if (!ctx.userId) {
        return value;
      }

      if (remoteConfig.vars.kvasirRequirePlus && !ctx.isPlus) {
        return value;
      }

      const typedParent = parent as {
        smartTitle: I18nRecord;
        clickbaitProbability?: string;
        manualClickbaitProbability?: string;
        translation: Partial<Record<ContentLanguage, PostTranslation>>;
        [key: string]: unknown;
      };

      const settings = await ctx.dataLoader.userSettings.load({
        userId: ctx.userId,
      });

      const i18nValue = ctx.contentLanguage
        ? typedParent.translation?.[ctx.contentLanguage]?.title
        : undefined;

      const altValue = getSmartTitle(
        ctx.contentLanguage,
        typedParent.smartTitle,
        typedParent.translation,
      );
      const clickbaitShieldEnabled =
        settings?.flags?.clickbaitShieldEnabled ?? true;

      // If manualClickbaitProbability is set, use it, otherwise use clickbaitProbability
      const clickbaitTitleDetected = checkIfTitleIsClickbait(
        typedParent.manualClickbaitProbability !== null
          ? typedParent.manualClickbaitProbability
          : typedParent.clickbaitProbability,
      );

      if (
        ctx.isPlus &&
        altValue &&
        clickbaitShieldEnabled &&
        clickbaitTitleDetected
      ) {
        return altValue;
      }

      if (i18nValue) {
        return i18nValue;
      }

      return value;
    },
  };
};

const organizationLink = (type: OrganizationLinkType) => ({
  jsonType: true,
  select: 'links',
  transform: (
    links: OrganizationLink[] | null,
  ): OrganizationLink[] | undefined =>
    links?.filter((link) => link.type === type),
});

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
      followingEmail: {
        transform: nullIfNotSameUser,
      },
      awardEmail: {
        transform: nullIfNotSameUser,
      },
      createdAt: {
        transform: transformDate,
      },
      isTeamMember: {
        select: (_, alias, qb) => {
          const query = qb
            .select('1')
            .from(Feature, 'f')
            .where(`f."userId" = ${alias}.id`)
            .andWhere(`f."feature" = :feature`, { feature: FeatureType.Team });

          return `EXISTS${query.getQuery()}`;
        },
        transform: (value: number): boolean => value > 0,
      },
      isPlus: {
        alias: { field: 'subscriptionFlags', type: 'jsonb' },
        transform: (subscriptionFlags: UserSubscriptionFlags) =>
          isPlusMember(subscriptionFlags?.cycle),
      },
      plusMemberSince: {
        alias: { field: 'subscriptionFlags', type: 'jsonb' },
        transform: (subscriptionFlags: UserSubscriptionFlags) =>
          transformDate(subscriptionFlags?.createdAt),
      },
      companies: {
        relation: {
          isMany: true,
          customRelation: (ctx, parentAlias, childAlias, qb): QueryBuilder =>
            qb
              .innerJoin(
                UserCompany,
                'uc',
                `"${childAlias}"."id" = uc."companyId"`,
              )
              .where('uc.verified = true')
              .andWhere(`uc."userId" = "${parentAlias}".id`)
              .limit(50),
        },
      },
      contentPreference: {
        relation: {
          isMany: false,
          customRelation: (ctx, parentAlias, childAlias, qb): QueryBuilder => {
            return qb
              .where(`${childAlias}."referenceId" = "${parentAlias}".id`)
              .andWhere(
                `${childAlias}."userId" = :currentContentPreferenceUserId`,
                {
                  currentContentPreferenceUserId: ctx.userId,
                },
              )
              .andWhere(`"${childAlias}".type = :type`, {
                type: ContentPreferenceType.User,
              });
          },
        },
        transform: nullIfNotLoggedIn,
      },
      topReader: {
        relation: {
          isMany: false,
          customRelation: (_, parentAlias, childAlias, qb): QueryBuilder =>
            qb
              .where(`${childAlias}."userId" = ${parentAlias}.id`)
              .orderBy(`${childAlias}."issuedAt"`, 'DESC')
              .limit(1),
        },
      },
    },
  },
  UserCompany: {
    fields: {
      user: {
        relation: {
          isMany: false,
          childColumn: 'id',
          parentColumn: 'userId',
        },
      },
      company: {
        relation: {
          isMany: false,
          childColumn: 'id',
          parentColumn: 'companyId',
        },
      },
    },
  },
  UserTopReader: {
    fields: {
      keyword: {
        relation: {
          isMany: false,
          childColumn: 'value',
          parentColumn: 'keywordValue',
        },
      },
      user: {
        relation: {
          isMany: false,
          childColumn: 'id',
          parentColumn: 'userId',
        },
      },
      total: {
        select: (_, alias, qb) =>
          qb
            .select('us."topReaderBadges"')
            .from(UserStats, 'us')
            .where(`us."id" = ${alias}."userId"`),
      },
    },
  },
  SourcePostModeration: {
    requiredColumns: ['id'],
    fields: {
      pollOptions: {
        jsonType: true,
      },
      flags: {
        jsonType: true,
      },
    },
  },
  UserStreak: {
    requiredColumns: ['lastViewAt'],
    fields: {
      max: { select: 'maxStreak' },
      total: { select: 'totalStreak' },
      current: { select: 'currentStreak' },
      balance: {
        jsonType: true,
      },
    },
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
      'slug',
      'translation',
      {
        column: `"contentMeta"->'alt_title'->'translations'`,
        columnAs: 'smartTitle',
        isJson: true,
      },
      {
        column: `"contentQuality"->'is_clickbait_probability'`,
        columnAs: 'clickbaitProbability',
        isJson: true,
      },
      {
        column: `"contentQuality"->'manual_clickbait_probability'`,
        columnAs: 'manualClickbaitProbability',
        isJson: true,
      },
    ],
    fields: {
      tags: {
        select: 'tagsStr',
        transform: (value: string): string[] => value?.split(',') ?? [],
      },
      clickbaitTitleDetected: {
        transform: (_, ctx: Context, parent): boolean => {
          const typedParent = parent as {
            clickbaitProbability: string;
            manualClickbaitProbability?: string;
            smartTitle: I18nRecord;
            translation: Partial<Record<ContentLanguage, PostTranslation>>;
          };
          const altValue = getSmartTitle(
            ctx.contentLanguage,
            typedParent.smartTitle,
            typedParent.translation,
          );

          return (
            !!altValue &&
            // If manualClickbaitProbability is set, use it, otherwise use clickbaitProbability
            checkIfTitleIsClickbait(
              typedParent.manualClickbaitProbability !== null
                ? typedParent.manualClickbaitProbability
                : typedParent.clickbaitProbability,
            )
          );
        },
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
        transform: (value: number, ctx, parent): number | null => {
          const post = parent as Post;

          const isAuthor = post?.authorId && ctx.userId === post.authorId;

          if (isAuthor) {
            return value;
          }

          const isScout = post?.scoutId && ctx.userId === post.scoutId;
          if (isScout) {
            return value;
          }

          return null;
        },
      },
      bookmark: {
        relation: {
          isMany: false,
          customRelation: (
            { userId },
            parentAlias,
            childAlias,
            qb,
          ): QueryBuilder =>
            qb
              .where(`${parentAlias}.id = ${childAlias}."postId"`)
              .andWhere(`${childAlias}."userId" = :userId`, { userId }),
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
      },
      numUpvotes: {
        select: 'upvotes',
      },
      numComments: {
        select: 'comments',
      },
      numAwards: {
        select: 'awards',
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
        transform: (value: PostFlagsPublic): PostFlagsPublic => {
          return {
            ...value,
            generatedAt: transformDate(value.generatedAt),
          };
        },
      },
      userState: {
        relation: {
          isMany: false,
          customRelation: (ctx, parentAlias, childAlias, qb): QueryBuilder => {
            return qb
              .where(`${childAlias}."userId" = :voteUserId`, {
                voteUserId: ctx.userId,
              })
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
              .limit(6);
          },
        },
        transform: (value: Source[], ctx: Context, parent): Source[] => {
          const post = parent as Post;

          if (post.type === PostType.Brief) {
            return value.slice(0, 6);
          }

          return value.slice(0, 3);
        },
      },
      numCollectionSources: {
        select: 'collectionSources',
        transform: (value: string[]): number => value?.length ?? 0,
      },
      domain: {
        alias: { field: 'url', type: 'string' },
        transform: (value: string): string => domainOnly(value),
      },
      title: createSmartTitleField({
        field: 'title',
      }),
      titleHtml: {
        select: 'titleHtml',
        transform: async (titleHtml: string, ctx: Context, parent) => {
          if (!ctx.userId) {
            return titleHtml;
          }

          if (remoteConfig.vars.kvasirRequirePlus && !ctx.isPlus) {
            return titleHtml;
          }

          const typedParent = parent as {
            translation: Partial<Record<ContentLanguage, PostTranslation>>;
          };

          const i18nTitleHtml = ctx.contentLanguage
            ? typedParent.translation?.[ctx.contentLanguage]?.titleHtml
            : undefined;

          if (i18nTitleHtml) {
            return i18nTitleHtml;
          }

          return titleHtml;
        },
      },
      summary: {
        select: 'summary',
        transform: async (summary: string, ctx: Context, parent) => {
          if (!ctx.userId || !ctx.isPlus) {
            return summary;
          }

          const typedParent = parent as {
            translation: Partial<Record<ContentLanguage, PostTranslation>>;
          };

          const i18nSummary = ctx.contentLanguage
            ? typedParent.translation?.[ctx.contentLanguage]?.summary
            : undefined;

          if (i18nSummary) {
            return i18nSummary;
          }

          return summary;
        },
      },
      translation: {
        jsonType: true,
        transform: (
          translations: Partial<Record<ContentLanguage, PostTranslation>>,
          ctx: Context,
        ): Partial<Record<keyof PostTranslation, boolean>> => {
          return getTranslationRecord({
            translations,
            contentLanguage: ctx.contentLanguage,
          });
        },
      },
      featuredAward: {
        relation: {
          isMany: false,
          customRelation: (ctx, parentAlias, childAlias, qb): QueryBuilder => {
            return qb
              .innerJoin(
                'UserTransaction',
                'awardUserTransaction',
                `"awardUserTransaction".id = "${childAlias}"."awardTransactionId"`,
              )
              .where(`"${childAlias}"."postId" = "${parentAlias}".id`)
              .andWhere(`"${childAlias}".flags->>'awardId' is not null`)
              .orderBy('"awardUserTransaction".value', 'DESC')
              .limit(1);
          },
        },
      },
      pollOptions: {
        relation: {
          isMany: true,
          sort: 'order',
          order: 'ASC',
          parentColumn: 'id',
          childColumn: 'postId',
        },
      },
      analytics: {
        transform: (value: number, ctx, parent): number | null => {
          const post = parent as Post;

          const isAuthor = post?.authorId && ctx.userId === post.authorId;

          if (isAuthor) {
            return value;
          }

          const isScout = post?.scoutId && ctx.userId === post.scoutId;

          if (isScout) {
            return value;
          }

          return null;
        },
      },
    },
  },
  SourceCategory: {
    requiredColumns: ['createdAt'],
  },
  Source: {
    requiredColumns: ['id', 'private', 'handle', 'type'],
    fields: {
      flags: {
        jsonType: true,
        transform: (value: SourceFlagsPublic): SourceFlagsPublic => {
          const {
            totalPosts,
            totalViews,
            totalUpvotes,
            totalMembers,
            featured,
            totalAwards,
          } = defaultPublicSourceFlags;

          return {
            totalPosts: value?.totalPosts ?? totalPosts,
            totalViews: value?.totalViews ?? totalViews,
            totalUpvotes: value?.totalUpvotes ?? totalUpvotes,
            totalMembers: value?.totalMembers ?? totalMembers,
            featured: value?.featured ?? featured,
            totalAwards: value?.totalAwards ?? totalAwards,
            campaignId: value?.campaignId,
          };
        },
      },
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
          limit: 5,
          hasNextPage: (size): boolean => size === 5,
          hasPreviousPage: (): boolean => false,
          nodeToCursor: (node: GQLComment): string =>
            base64(`time:${new Date(node.createdAt).getTime()}`),
        },
      },
      membersCount: {
        select: 'flags',
        transform: (value: SourceFlagsPublic): number =>
          value?.totalMembers || 0,
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
        transform: (value: [number, number], ctx: Context, parent) => {
          const member = parent as SourceMember;

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
                    `WHEN "role" = '${role}' THEN ${sourceRoleRank[role as keyof typeof sourceRoleRank]}`,
                )
                .join(' ')}
            ELSE 0 END)
          `,
      },
      referralToken: {
        transform: (value: string, ctx: Context, parent) => {
          const member = parent as SourceMember;

          return nullIfNotSameUser(value, ctx, { id: member.userId });
        },
      },
      flags: {
        jsonType: true,
      },
    },
  },
  Bookmark: {
    from: 'Bookmark',
    fields: {
      remindAt: { transform: transformDate },
      createdAt: { transform: transformDate },
    },
  },
  Comment: {
    requiredColumns: ['id', 'postId', 'createdAt'],
    fields: {
      createdAt: { transform: transformDate },
      lastUpdatedAt: { transform: transformDate },
      upvoted: {
        select: (ctx: Context, alias: string, qb: QueryBuilder): string => {
          const query = qb
            .select('1')
            .from(UserComment, 'cu')
            .where(`cu."userId" = :userId`, { userId: ctx.userId })
            .andWhere(`cu."commentId" = ${alias}.id`)
            .andWhere(`cu."vote" = :vote`, { vote: UserVote.Up });
          return `EXISTS${query.getQuery()}`;
        },
        transform: nullIfNotLoggedIn,
      },
      numUpvotes: {
        select: 'upvotes',
      },
      numAwards: {
        select: 'awards',
      },
      children: {
        relation: {
          isMany: true,
          childColumn: 'parentId',
          order: 'ASC',
          sort: 'createdAt',
          customRelation(ctx, parentAlias, childAlias, qb) {
            const builder = qb
              .where(`"${childAlias}"."parentId" = "${parentAlias}"."id"`)
              .andWhere(whereVordrFilter(childAlias, ctx.userId));

            if (ctx.userId) {
              builder.andWhere(
                whereNotUserBlocked(qb, {
                  userId: ctx.userId,
                }),
              );
            }

            return builder;
          },
        },
        pagination: {
          limit: 100,
          hasNextPage: (size): boolean => size === 100,
          hasPreviousPage: (): boolean => false,
          nodeToCursor: (node: GQLComment): string =>
            base64(`time:${new Date(node.createdAt).getTime()}`),
        },
      },
      parent: {
        relation: {
          isMany: false,
          childColumn: 'id',
          parentColumn: 'parentId',
        },
      },
      userState: {
        relation: {
          isMany: false,
          customRelation: (ctx, parentAlias, childAlias, qb): QueryBuilder => {
            return qb
              .where(`${childAlias}."userId" = :voteUserId`, {
                voteUserId: ctx.userId,
              })
              .andWhere(`${childAlias}."commentId" = "${parentAlias}".id`);
          },
        },
        transform: (value: GQLComment, ctx: Context) => {
          if (!ctx.userId) {
            return null;
          }

          if (!value) {
            return ctx.con.getRepository(UserComment).create();
          }

          return value;
        },
      },
      fromAward: {
        select: '"awardTransactionId" IS NOT NULL',
        rawSelect: true,
      },
      award: {
        relation: {
          isMany: false,
          customRelation: (ctx, parentAlias, childAlias, qb): QueryBuilder =>
            qb
              .where(
                `${childAlias}."id" = ("${parentAlias}".flags->>'awardId')::uuid`,
              )
              .limit(1),
        },
      },
      featuredAward: {
        relation: {
          isMany: false,
          customRelation: (ctx, parentAlias, childAlias, qb): QueryBuilder => {
            return qb
              .innerJoin(
                'UserTransaction',
                'awardUserTransaction',
                `"awardUserTransaction".id = "${childAlias}"."awardTransactionId"`,
              )
              .where(`"${childAlias}"."commentId" = "${parentAlias}".id`)
              .andWhere(`"${childAlias}".flags->>'awardId' is not null`)
              .orderBy('"awardUserTransaction".value', 'DESC')
              .limit(1);
          },
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
            .select(`string_agg("keywordId", ',' order by "keywordId")`)
            .from(ContentPreference, 'cpk')
            .where(`cpk."feedId" = "${alias}".id`)
            .andWhere('cpk.type = :contentPreferenceType', {
              contentPreferenceType: ContentPreferenceType.Keyword,
            })
            .andWhere('cpk.status != :contentPreferenceStatus', {
              contentPreferenceStatus: ContentPreferenceStatus.Blocked,
            }),
        transform: (value: string): string[] => value?.split(',') ?? [],
      },
      blockedTags: {
        select: (ctx, alias, qb): QueryBuilder =>
          qb
            .select(`string_agg("keywordId", ',' order by "keywordId")`)
            .from(ContentPreference, 'cpk')
            .where(`cpk."feedId" = "${alias}".id`)
            .andWhere('cpk.type = :contentPreferenceType', {
              contentPreferenceType: ContentPreferenceType.Keyword,
            })
            .andWhere('cpk.status = :contentPreferenceStatus', {
              contentPreferenceStatus: ContentPreferenceStatus.Blocked,
            }),
        transform: (value: string): string[] => value?.split(',') ?? [],
      },
      includeSources: {
        relation: {
          isMany: true,
          customRelation: (ctx, parentAlias, childAlias, qb): QueryBuilder =>
            qb
              .innerJoin(
                ContentPreferenceSource,
                'cps',
                `"${childAlias}"."id" = cps."referenceId"`,
              )
              .where(`cps."feedId" = "${parentAlias}".id`)
              .andWhere('cps.type = :contentPreferenceSourceType', {
                contentPreferenceSourceType: ContentPreferenceType.Source,
              })
              .andWhere('cps.status != :contentPreferenceSourceStatus', {
                contentPreferenceSourceStatus: ContentPreferenceStatus.Blocked,
              })
              .orderBy(`"${childAlias}".name`),
        },
      },
      excludeSources: {
        relation: {
          isMany: true,
          customRelation: (ctx, parentAlias, childAlias, qb): QueryBuilder =>
            qb
              .innerJoin(
                ContentPreferenceSource,
                'cps',
                `"${childAlias}"."id" = cps."referenceId"`,
              )
              .where(`cps."feedId" = "${parentAlias}".id`)
              .andWhere('cps.type = :contentPreferenceSourceType', {
                contentPreferenceSourceType: ContentPreferenceType.Source,
              })
              .andWhere('cps.status = :contentPreferenceSourceStatus', {
                contentPreferenceSourceStatus: ContentPreferenceStatus.Blocked,
              })
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
  Settings: {
    fields: {
      flags: {
        jsonType: true,
        transform: (value: SettingsFlagsPublic): SettingsFlagsPublic => {
          return transformSettingFlags({ flags: value });
        },
      },
    },
  },
  AdvancedSettings: {
    fields: {
      options: {
        jsonType: true,
        transform: async ({ source, ...rest }, ctx) => {
          return {
            ...(source && {
              source: await ctx.getRepository(Source).findOneBy({ id: source }),
            }),
            ...rest,
          };
        },
      },
    },
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
    requiredColumns: ['votedAt', 'awardTransactionId', 'pollVoteOptionId'],
    fields: {
      flags: {
        jsonType: true,
      },
      awarded: {
        select: '"awardTransactionId" IS NOT NULL',
        rawSelect: true,
      },
      award: {
        relation: {
          isMany: false,
          customRelation: (ctx, parentAlias, childAlias, qb): QueryBuilder => {
            return qb.where(
              `${childAlias}.id = ("${parentAlias}".flags->>'awardId')::uuid`,
            );
          },
        },
      },
    },
  },
  PostQuestion: {
    requiredColumns: ['id'],
  },
  UserPersonalizedDigest: {
    requiredColumns: ['userId'],
    fields: {
      flags: {
        jsonType: true,
        transform: (
          value: UserPersonalizedDigestFlagsPublic,
        ): UserPersonalizedDigestFlagsPublic => {
          return {
            sendType: value?.sendType ?? UserPersonalizedDigestSendType.weekly,
          };
        },
      },
    },
  },
  Keyword: {
    fields: {
      flags: {
        jsonType: true,
        transform: async ({ roadmap, ...rest }) => {
          return {
            ...(roadmap && {
              roadmap: `https://roadmap.sh/${roadmap}?ref=dailydev`,
            }),
            ...rest,
          };
        },
      },
    },
  },
  UserComment: {
    requiredColumns: ['votedAt', 'awardTransactionId'],
    fields: {
      flags: {
        jsonType: true,
      },
      awarded: {
        select: '"awardTransactionId" IS NOT NULL',
        rawSelect: true,
      },
      award: {
        relation: {
          isMany: false,
          customRelation: (ctx, parentAlias, childAlias, qb): QueryBuilder => {
            return qb.where(
              `${childAlias}.id = ("${parentAlias}".flags->>'awardId')::uuid`,
            );
          },
        },
      },
    },
  },
  Feed: {
    requiredColumns: ['createdAt'],
    fields: {
      flags: {
        jsonType: true,
      },
    },
  },
  UserIntegration: {
    requiredColumns: ['id', 'type', 'meta', 'createdAt'],
    fields: {
      meta: {
        jsonType: true,
      },
      createdAt: {
        transform: transformDate,
      },
      updatedAt: {
        transform: transformDate,
      },
    },
  },
  PostCodeSnippet: {
    requiredColumns: ['order'],
  },
  ContentPreference: {
    requiredColumns: ['createdAt'],
    fields: {
      createdAt: {
        transform: transformDate,
      },
    },
  },
  Prompt: {
    fields: {
      flags: {
        jsonType: true,
      },
    },
  },
  Product: {
    fields: {
      flags: {
        jsonType: true,
      },
    },
  },
  UserTransaction: {
    fields: {
      flags: {
        jsonType: true,
      },
      sourceName: {
        rawSelect: true,
        select: (_, alias) => {
          return `${alias}.flags->>'sourceId'`;
        },
        transform: async (value: string, ctx: Context) => {
          if (!value) {
            return;
          }
          const source = await ctx.getRepository(Source).findOne({
            select: ['name'],
            where: { id: value },
          });
          return source?.name;
        },
      },
      balance: {
        jsonType: true,
        transform: async (_, ctx): Promise<GetBalanceResult> => {
          if (!ctx.userId) {
            return {
              amount: 0,
            };
          }

          return ctx.dataLoader.userBalance.load({ userId: ctx.userId });
        },
      },
    },
  },
  UserTransactionPublic: {
    from: 'UserTransaction',
  },
  UserOrganization: {
    from: 'ContentPreferenceOrganization',
    additionalQuery: (_, alias, qb) =>
      qb.andWhere(
        `"${alias}"."type" = '${ContentPreferenceType.Organization}'`,
      ),
    requiredColumns: ['userId', 'flags', 'organizationId'],
    fields: {
      referralToken: {
        rawSelect: true,
        select: (_, alias) => {
          return `${alias}.flags->>'referralToken'`;
        },
        transform: (value: string, ctx: Context, parent) => {
          const member = parent as ContentPreferenceOrganization;
          return nullIfNotSameUser(value, ctx, { id: member.userId });
        },
      },
      referralUrl: {
        rawSelect: true,
        select: (_, alias) => {
          return `${alias}.flags->>'referralToken'`;
        },
        transform: async (value: string, ctx: Context, parent) => {
          const member = parent as ContentPreferenceOrganization;
          const referralUrl = await ctx.dataLoader.organizationReferralUrl.load(
            {
              organizationId: member.organizationId,
              referralToken: value,
            },
          );
          return nullIfNotSameUser(referralUrl, ctx, {
            id: member.userId,
          });
        },
      },
      role: {
        rawSelect: true,
        select: (_, alias) =>
          `COALESCE(${alias}.flags->>'role', '${OrganizationMemberRole.Member}')`,
      },
      seatType: {
        alias: { field: 'status', type: 'string' },
      },
    },
  },
  Organization: {
    requiredColumns: ['id'],
    fields: {
      createdAt: {
        transform: transformDate,
      },
      updatedAt: {
        transform: transformDate,
      },
      subscriptionFlags: {
        jsonType: true,
      },
      links: {
        jsonType: true,
      },
      members: {
        customQuery: (ctx, alias, qb) =>
          qb
            .andWhere(`${alias}."userId" != :userId`, {
              userId: ctx.userId,
            })
            .orderBy(
              `CASE (${alias}."flags"->>'role')
              WHEN 'owner' THEN 1
              WHEN 'admin' THEN 2
              WHEN 'member' THEN 3
              ELSE 4
            END`,
              'ASC',
            )
            .addOrderBy(`"${alias}"."createdAt"`, 'ASC'),
      },
      status: {
        rawSelect: true,
        select: (_, alias) => `${alias}."subscriptionFlags"->>'status'`,
      },
      activeSeats: {
        rawSelect: true,
        select: (_, alias, qb) =>
          qb
            .select('count(*)')
            .from(ContentPreference, 'cpo')
            .where(`"cpo"."organizationId" = ${alias}.id`)
            .andWhere(`"cpo"."type" = :type`)
            .andWhere(`"cpo"."status" = :status`)
            .setParameters({
              type: ContentPreferenceType.Organization,
              status: ContentPreferenceOrganizationStatus.Plus,
            }),
      },
      customLinks: organizationLink(OrganizationLinkType.Custom),
      socialLinks: organizationLink(OrganizationLinkType.Social),
      pressLinks: organizationLink(OrganizationLinkType.Press),
    },
  },
  OrganizationMember: {
    requiredColumns: ['userId'],
    from: 'ContentPreferenceOrganization',
    additionalQuery: (_, alias, qb) =>
      qb.andWhere(
        `"${alias}"."type" = '${ContentPreferenceType.Organization}'`,
      ),
    fields: {
      role: {
        rawSelect: true,
        select: (_, alias) =>
          `COALESCE(${alias}.flags->>'role', '${OrganizationMemberRole.Member}')`,
      },
      seatType: {
        alias: { field: 'status', type: 'string' },
      },
    },
  },
  Campaign: {
    requiredColumns: ['id', 'userId'],
    fields: {
      flags: {
        jsonType: true,
        transform: (flag, ctx, parent) => {
          if (ctx.userId === (parent as Campaign).userId) {
            return flag;
          }

          return {};
        },
      },
      createdAt: {
        transform: (value, ctx, parent) => {
          const campaign = parent as Campaign;
          return nullIfNotSameUser(value, ctx, { id: campaign.userId });
        },
      },
      state: {
        transform: (value: string, ctx: Context, parent) => {
          const campaign = parent as Campaign;
          return nullIfNotSameUser(value, ctx, { id: campaign.userId });
        },
      },
    },
  },
  PostAnalytics: {
    requiredColumns: ['id', 'updatedAt'],
    fields: {
      updatedAt: {
        transform: transformDate,
      },
      upvotesRatio: {
        rawSelect: true,
        select: (_, alias) => {
          return `
            CASE
              WHEN (${alias}.upvotes + ${alias}.downvotes) > 0
              THEN ROUND((${alias}.upvotes::numeric / (${alias}.upvotes + ${alias}.downvotes)) * 100, 0)
              ELSE 0
            END
          `;
        },
      },
      shares: {
        rawSelect: true,
        select: (_, alias) => {
          return `
            GREATEST(${alias}."sharesInternal" + ${alias}."sharesExternal", 0)
          `;
        },
      },
      reputation: {
        transform: (value) => {
          return Math.max(0, value);
        },
      },
      impressions: {
        rawSelect: true,
        select: (_, alias) => {
          return `
            GREATEST(${alias}.impressions + ${alias}."impressionsAds", 0)
          `;
        },
      },
      reach: {
        rawSelect: true,
        select: (_, alias) => {
          // fallback if reachAll is not aggregated, we did not backfill for old posts without authors
          return `
            GREATEST(${alias}."reachAll", ${alias}.reach, 0)
          `;
        },
      },
      clicks: {
        rawSelect: true,
        select: (_, alias) => {
          return `
            GREATEST(${alias}.clicks + ${alias}."clicksAds", 0)
          `;
        },
      },
    },
  },
  PostAnalyticsHistory: {
    requiredColumns: ['id', 'date', 'updatedAt'],
    fields: {
      date: {
        transform: transformDate,
      },
      updatedAt: {
        transform: transformDate,
      },
      impressions: {
        rawSelect: true,
        select: (_, alias) => {
          return `
            GREATEST(${alias}.impressions + ${alias}."impressionsAds", 0)
          `;
        },
      },
    },
  },
  PostAnalyticsPublic: {
    from: 'PostAnalytics',
    fields: {
      impressions: {
        rawSelect: true,
        select: (_, alias) => {
          return `
            GREATEST(${alias}.impressions + ${alias}."impressionsAds", 0)
          `;
        },
      },
    },
  },
  Opportunity: {
    fields: {
      createdAt: {
        transform: transformDate,
      },
      updatedAt: {
        transform: transformDate,
      },
      content: {
        jsonType: true,
      },
      organization: {
        relation: {
          isMany: false,
          childColumn: 'id',
          parentColumn: 'organizationId',
        },
      },
      meta: {
        jsonType: true,
      },
      location: {
        jsonType: true,
      },
      recruiters: {
        relation: {
          isMany: true,
          customRelation: (_, parentAlias, childAlias, qb): QueryBuilder =>
            qb
              .innerJoin(
                OpportunityUserRecruiter,
                'ou',
                `"${childAlias}"."id" = ou."userId"`,
              )
              .where(`ou."opportunityId" = "${parentAlias}".id`)
              .andWhere(`ou."type" = :type`, {
                type: OpportunityUserType.Recruiter,
              }),
        },
      },
      keywords: {
        relation: {
          isMany: true,
          parentColumn: 'id',
          childColumn: 'opportunityId',
        },
      },
    },
  },
  OpportunityScreeningQuestion: {
    from: 'QuestionScreening',
    requiredColumns: ['questionOrder'],
    additionalQuery: (_, alias, qb) =>
      qb.orderBy(`${alias}."questionOrder"`, 'ASC'),
    fields: {
      order: {
        alias: { field: 'questionOrder', type: 'int' },
      },
    },
  },
  OpportunityMatch: {
    fields: {
      createdAt: {
        transform: transformDate,
      },
      updatedAt: {
        transform: transformDate,
      },
      description: {
        jsonType: true,
      },
      screening: {
        jsonType: true,
      },
      applicationRank: {
        jsonType: true,
      },
      opportunity: {
        relation: {
          isMany: false,
          childColumn: 'id',
          parentColumn: 'opportunityId',
        },
      },
      user: {
        relation: {
          isMany: false,
          childColumn: 'id',
          parentColumn: 'userId',
        },
      },
    },
  },
  UserCandidatePreference: {
    fields: {
      cv: {
        jsonType: true,
        transform: (value: GCSBlob) => ({
          ...value,
          lastModified: transformDate(value?.lastModified),
        }),
      },
      employmentAgreement: {
        jsonType: true,
        transform: (value: GCSBlob) => ({
          ...value,
          lastModified: transformDate(value?.lastModified),
        }),
      },
      salaryExpectation: {
        jsonType: true,
      },
      location: {
        jsonType: true,
      },
      keywords: {
        relation: {
          isMany: true,
          parentColumn: 'userId',
          childColumn: 'userId',
        },
      },
    },
  },
  Location: {
    from: 'DatasetLocation',
  },
  UserExperience: {
    anonymousAllowedColumns: [
      'id',
      'type',
      'title',
      'company',
      'customCompanyName',
    ],
    fields: {
      startedAt: {
        transform: transformDate,
      },
      endedAt: {
        transform: transformDate,
      },
      createdAt: {
        transform: transformDate,
      },
    },
  },
});

export default obj;
