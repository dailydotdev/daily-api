import { emailRegex, isNullOrUndefined } from './../common/object';
import { getMostReadTags } from './../common/devcard';
import { GraphORMBuilder } from '../graphorm/graphorm';
import { Connection, ConnectionArguments } from 'graphql-relay';
import {
  Comment,
  Feature,
  FeatureType,
  FeatureValue,
  MarketingCta,
  Post,
  PostStats,
  ReputationEvent,
  ReputationReason,
  ReputationType,
  User,
  UserMarketingCta,
  View,
  CampaignType,
  Invite,
  UserPersonalizedDigest,
  UserPersonalizedDigestFlags,
  UserPersonalizedDigestFlagsPublic,
  UserPersonalizedDigestSendType,
  UserPersonalizedDigestType,
  UserStreak,
  UserStreakAction,
  UserStreakActionType,
  getAuthorPostStats,
  Alerts,
  reputationReasonAmount,
} from '../entity';
import {
  AuthenticationError,
  ForbiddenError,
  ValidationError,
} from 'apollo-server-errors';
import { IResolvers } from '@graphql-tools/utils';
// @ts-expect-error - no types
import { FileUpload } from 'graphql-upload/GraphQLUpload.js';
import { AuthContext, BaseContext, Context } from '../Context';
import { traceResolvers } from './trace';
import {
  GQLDatePageGeneratorConfig,
  queryPaginatedByDate,
} from '../common/datePageGenerator';
import {
  DayOfWeek,
  GQLUserCompany,
  GQLUserIntegration,
  GQLUserStreak,
  GQLUserStreakTz,
  StreakRecoverQueryResult,
  TagsReadingStatus,
  VALID_WEEK_STARTS,
  checkAndClearUserStreak,
  getInviteLink,
  getShortUrl,
  getUserPermalink,
  getUserReadingRank,
  resubscribeUser,
  sendEmail,
  toGQLEnum,
  uploadAvatar,
  uploadProfileCover,
  voteComment,
  votePost,
  CioTransactionalMessageTemplateId,
  validateWorkEmailDomain,
  type GQLUserTopReader,
  mapCloudinaryUrl,
} from '../common';
import { getSearchQuery, GQLEmptyResponse, processSearchQuery } from './common';
import { ActiveView } from '../entity/ActiveView';
import graphorm from '../graphorm';
import { GraphQLResolveInfo } from 'graphql';
import {
  ConflictError,
  NotFoundError,
  SubmissionFailErrorKeys,
  TypeORMQueryFailedError,
  TypeOrmError,
} from '../errors';
import { deleteUser } from '../directive/user';
import { randomInt } from 'crypto';
import { ArrayContains, DataSource, In, IsNull, QueryRunner } from 'typeorm';
import { DisallowHandle } from '../entity/DisallowHandle';
import { ContentLanguage, UserVote, UserVoteEntity } from '../types';
import { markdown } from '../common/markdown';
import { deleteRedisKey, getRedisObject, RedisMagicValues } from '../redis';
import { generateStorageKey, StorageKey, StorageTopic } from '../config';
import { FastifyBaseLogger } from 'fastify';
import { cachePrefillMarketingCta } from '../common/redisCache';
import { cio, identifyUserPersonalizedDigest } from '../cio';
import {
  UserIntegration,
  UserIntegrationSlack,
  UserIntegrationType,
} from '../entity/UserIntegration';
import { Company } from '../entity/Company';
import { UserCompany } from '../entity/UserCompany';
import { generateVerifyCode } from '../ids';
import { validateUserUpdate } from '../entity/user/utils';
import { getRestoreStreakCache } from '../workers/cdc/primary';
import { ReportEntity, ReportReason } from '../entity/common';
import { reportFunctionMap } from '../common/reporting';
import { format } from 'date-fns';
import { ContentPreferenceUser } from '../entity/contentPreference/ContentPreferenceUser';
import { ContentPreferenceStatus } from '../entity/contentPreference/types';

export interface GQLUpdateUserInput {
  name: string;
  email?: string;
  username?: string;
  bio?: string;
  company?: string;
  title: string;
  image?: string;
  twitter?: string;
  github?: string;
  roadmap?: string;
  threads?: string;
  codepen?: string;
  reddit?: string;
  stackoverflow?: string;
  youtube?: string;
  linkedin?: string;
  mastodon?: string;
  hashnode?: string;
  portfolio?: string;
  acceptedMarketing?: boolean;
  notificationEmail?: boolean;
  timezone?: string;
  weekStart?: number;
  infoConfirmed?: boolean;
  experienceLevel?: string;
  language?: ContentLanguage;
  followingEmail?: boolean;
  followNotifications?: boolean;
}

interface GQLUserParameters {
  data: GQLUpdateUserInput;
  upload: Promise<FileUpload>;
}

export interface GQLUser {
  id: string;
  name: string;
  image?: string;
  infoConfirmed: boolean;
  createdAt: Date;
  username?: string;
  bio?: string;
  twitter?: string;
  github?: string;
  roadmap?: string;
  threads?: string;
  codepen?: string;
  reddit?: string;
  stackoverflow?: string;
  youtube?: string;
  linkedin?: string;
  mastodon?: string;
  hashnode?: string;
  portfolio?: string;
  reputation?: number;
  notificationEmail?: boolean;
  timezone?: string;
  cover?: string;
  readme?: string;
  readmeHtml?: string;
  experienceLevel?: string | null;
  language?: ContentLanguage | null;
  topReader?: GQLUserTopReader;
}

export interface GQLView {
  post: Post;
  timestamp: Date;
  timestampDb: Date;
}

type CommentStats = { numComments: number; numCommentUpvotes: number };

type FollowStats = { numFollowing: number; numFollowers: number };

export type GQLUserStats = Omit<PostStats, 'numPostComments'> &
  CommentStats &
  FollowStats;

export interface GQLReadingRank {
  rankThisWeek?: number;
  rankLastWeek?: number;
  currentRank: number;
  progressThisWeek?: number;
  readToday?: boolean;
  lastReadTime?: Date;
  tags?: TagsReadingStatus[];
}

export interface GQLReadingRankHistory {
  rank: number;
  count: number;
}

export interface GQLMostReadTag {
  value: string;
  count: number;
  percentage?: number;
  total?: number;
}

export interface ReadingRankArgs {
  id: string;
  version?: number;
  limit?: number;
}

export interface ReferralCampaign {
  referredUsersCount: number;
  referralCountLimit?: number;
  referralToken?: string;
  url: string;
}

export interface GQLUserPersonalizedDigest {
  preferredDay: DayOfWeek;
  preferredHour: number;
  type: UserPersonalizedDigestType;
  flags: UserPersonalizedDigestFlagsPublic;
}

export interface SendReportArgs {
  type: ReportEntity;
  id: string;
  reason: ReportReason;
  comment?: string;
  tags?: string[];
}

export const typeDefs = /* GraphQL */ `
  type Company {
    id: String!
    name: String!
    image: String
  }

  type UserCompany {
    """
    Date when the record was created
    """
    createdAt: DateTime!
    """
    Date when the record was updated
    """
    updatedAt: DateTime!
    """
    Whether the record is verified
    """
    verified: Boolean!
    """
    Email associated with record
    """
    email: String!
    """
    Company connected to this record
    """
    company: Company
  }

  """
  Registered user
  """
  type User {
    """
    ID of the user
    """
    id: String!
    """
    Full name of the user
    """
    name: String
    """
    Email for the user
    """
    email: String
    """
    Current company of the user
    """
    company: String
    """
    Title of user from their company
    """
    title: String
    """
    Profile image of the user
    """
    image: String
    """
    Cover image of the user
    """
    cover: String
    """
    Username (handle) of the user
    """
    username: String
    """
    URL to the user's profile page
    """
    permalink: String!
    """
    Bio of the user
    """
    bio: String
    """
    Twitter handle of the user
    """
    twitter: String
    """
    Github handle of the user
    """
    github: String
    """
    Hashnode handle of the user
    """
    hashnode: String
    """
    Roadmap profile of the user
    """
    roadmap: String
    """
    Threads profile of the user
    """
    threads: String
    """
    Codepen profile of the user
    """
    codepen: String
    """
    Reddit profile of the user
    """
    reddit: String
    """
    Stackoverflow profile of the user
    """
    stackoverflow: String
    """
    Youtube profile of the user
    """
    youtube: String
    """
    Linkedin profile of the user
    """
    linkedin: String
    """
    Mastodon profile of the user
    """
    mastodon: String
    """
    Portfolio URL of the user
    """
    portfolio: String
    """
    Date when the user joined
    """
    createdAt: DateTime!
    """
    If the user is confirmed
    """
    infoConfirmed: Boolean
    """
    Timezone of the user
    """
    timezone: String
    """
    Reputation of the user
    """
    reputation: Int
    """
    If the user has accepted marketing
    """
    acceptedMarketing: Boolean
    """
    If the user should receive email for notifications
    """
    notificationEmail: Boolean
    """
    Markdown version of the user's readme
    """
    readme: String
    """
    HTML rendered version of the user's readme
    """
    readmeHtml: String
    """
    Experience level of the user
    """
    experienceLevel: String
    """
    Whether the user is a team member
    """
    isTeamMember: Boolean
    """
    Verified companies for this user
    """
    companies: [Company]
    """
    Preferred language of the user
    """
    language: String
    """
    Content preference in regards to current user
    """
    contentPreference: ContentPreference

    """
    Returns the latest top reader badge for the user
    """
    topReader: UserTopReader
  }

  """
  Update user profile input
  """
  input UpdateUserInput {
    """
    Full name of the user
    """
    name: String
    """
    Email for the user
    """
    email: String
    """
    Profile image of the user
    """
    image: String
    """
    Username (handle) of the user
    """
    username: String
    """
    Bio of the user
    """
    bio: String
    """
    Twitter handle of the user
    """
    twitter: String
    """
    Github handle of the user
    """
    github: String
    """
    Hashnode handle of the user
    """
    hashnode: String
    """
    Roadmap profile of the user
    """
    roadmap: String
    """
    Threads profile of the user
    """
    threads: String
    """
    Codepen profile of the user
    """
    codepen: String
    """
    Reddit profile of the user
    """
    reddit: String
    """
    Stackoverflow profile of the user
    """
    stackoverflow: String
    """
    Youtube profile of the user
    """
    youtube: String
    """
    Linkedin profile of the user
    """
    linkedin: String
    """
    Mastodon profile of the user
    """
    mastodon: String
    """
    Preferred timezone of the user that affects data
    """
    timezone: String
    """
    Preferred day of the week to start the week
    """
    weekStart: Int
    """
    Current company of the user
    """
    company: String
    """
    Title of user from their company
    """
    title: String
    """
    User website
    """
    portfolio: String
    """
    If the user has accepted marketing
    """
    acceptedMarketing: Boolean
    """
    If the user should receive email for notifications
    """
    notificationEmail: Boolean
    """
    If the user's info is confirmed
    """
    infoConfirmed: Boolean
    """
    Experience level of the user
    """
    experienceLevel: String
    """
    Preferred language of the user
    """
    language: String
    """
    Whether the user wants to receive follwing email notifications
    """
    followingEmail: Boolean
    """
    Whether the user wants to receives following push notifications
    """
    followNotifications: Boolean
  }

  type TagsReadingStatus {
    tag: String!
    readingDays: Int!
    percentage: Float
  }

  type UserStats {
    numPosts: Int!
    numComments: Int!
    numPostViews: Int
    numPostUpvotes: Int
    numCommentUpvotes: Int
    numFollowers: Int
    numFollowing: Int
  }

  type ReadingRank {
    rankThisWeek: Int
    rankLastWeek: Int
    currentRank: Int!
    progressThisWeek: Int
    readToday: Boolean
    lastReadTime: DateTime
    tags: [TagsReadingStatus]
  }

  type StreakRecoverQuery {
    canRecover: Boolean!
    cost: Int!
    oldStreakLength: Int!
  }

  type MostReadTag {
    value: String!
    count: Int!
    percentage: Float
    total: Int
  }

  type ReadingRankHistory {
    rank: Int!
    count: Int!
  }

  type ReadHistory {
    date: String!
    reads: Int!
  }

  type SearchReadingHistorySuggestion {
    title: String!
  }

  type SearchReadingHistorySuggestionsResults {
    query: String!
    hits: [SearchReadingHistorySuggestion!]!
  }

  type ReadingHistory {
    timestamp: DateTime!
    timestampDb: DateTime!
    post: Post!
  }

  type ReadingHistoryEdge {
    node: ReadingHistory!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  type ReadingHistoryConnection {
    pageInfo: PageInfo!
    edges: [ReadingHistoryEdge]!
  }

  type ReferralCampaign {
    referredUsersCount: Int!
    referralCountLimit: Int
    referralToken: String
    url: String!
  }

  """
  flags property of UserPersonalizedDigest entity
  """
  type PersonalizedDigestFlagsPublic {
    sendType: UserPersonalizedDigestSendType
  }

  type UserPersonalizedDigest {
    preferredDay: Int!
    preferredHour: Int!
    flags: PersonalizedDigestFlagsPublic
    type: DigestType
  }

  ${toGQLEnum(UserPersonalizedDigestSendType, 'UserPersonalizedDigestSendType')}

  type UserEdge {
    node: User!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  type UserConnection {
    pageInfo: PageInfo!
    edges: [UserEdge!]!
  }

  type UserStreak {
    max: Int
    total: Int
    current: Int
    lastViewAt: DateTime
    weekStart: Int
  }

  ${toGQLEnum(UserPersonalizedDigestType, 'DigestType')}

  ${toGQLEnum(UserVoteEntity, 'UserVoteEntity')}

  ${toGQLEnum(ReportReason, 'ReportReason')}

  ${toGQLEnum(ReportEntity, 'ReportEntity')}

  type UserIntegration {
    id: ID!
    type: String!
    createdAt: DateTime!
    updatedAt: DateTime!
    name: String!
    userId: ID!
  }

  type UserIntegrationEdge {
    node: UserIntegration!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  type UserIntegrationConnection {
    pageInfo: PageInfo!
    edges: [UserIntegrationEdge!]!
  }

  type UserTopReader {
    """
    Unique identifier for the top reader badge
    """
    id: ID

    """
    User
    """
    user: User

    """
    Date and time when the badge was issued
    """
    issuedAt: DateTime

    """
    Keyword
    """
    keyword: Keyword

    """
    URL to the badge image
    """
    image: String

    """
    Total number of badges
    """
    total: Int
  }

  extend type Query {
    """
    Get user based on logged in session
    """
    whoami: User @auth
    """
    Get the statistics of the user
    """
    userStats(id: ID!): UserStats @cacheControl(maxAge: 600)
    """
    Get User Streak
    """
    userStreak: UserStreak @auth
    """
    Get User Streak Profile
    """
    userStreakProfile(id: ID!): UserStreak
    """
    Get the reading rank of the user
    """
    userReadingRank(id: ID!, version: Int, limit: Int): ReadingRank
    """
    Get information about the user streak recovery
    """
    streakRecover: StreakRecoverQuery @auth
    """
    Get the most read tags of the user
    """
    userMostReadTags(
      id: ID!
      after: String
      before: String
      limit: Int
    ): [MostReadTag]
    """
    Get the reading rank history of the user.
    An aggregated count of all the ranks the user ever received.
    """
    userReadingRankHistory(
      id: ID!
      after: String
      before: String
      version: Int
    ): [ReadingRankHistory]
    """
    Get a heatmap of reads per day in a given time frame.
    """
    userReadHistory(id: ID!, after: String!, before: String!): [ReadHistory]
    """
    Get the number of articles the user read
    """
    userReads: Int @auth

    """
    Get suggestions for search reading history query
    """
    searchReadingHistorySuggestions(
      """
      The query to search for
      """
      query: String!
    ): SearchReadingHistorySuggestionsResults!

    """
    Get user's info
    """
    user(id: ID!): User

    """
    Get user's reading history
    """
    readHistory(
      """
      If true it only return public posts
      """
      isPublic: Boolean

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int
    ): ReadingHistoryConnection! @auth

    """
    Search through users reading history
    """
    searchReadingHistory(
      """
      The query to search for
      """
      query: String!

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int
    ): ReadingHistoryConnection! @auth

    """
    Create a unique username for the user
    """
    generateUniqueUsername(
      """
      The name to generate a username from
      """
      name: String!
    ): String! @rateLimit(limit: 20, duration: 60)

    """
    Get referral campaign progress for user
    """
    referralCampaign(
      """
      Referral origin for campaign
      """
      referralOrigin: String!
    ): ReferralCampaign! @auth

    """
    Get personalized digest settings for user
    """
    personalizedDigest: [UserPersonalizedDigest] @auth

    """
    List of users that the logged in user has referred to the platform
    """
    referredUsers: UserConnection @auth

    """
    Get integrations for the user
    """
    userIntegrations: UserIntegrationConnection @auth

    """
    Get user integration by id
    """
    userIntegration(id: ID!): UserIntegration @auth

    """
    Get companies for user
    """
    companies: [UserCompany] @auth

    """
    Get the latest top reader badges for the user
    """
    topReaderBadge(limit: Int, userId: ID!): [UserTopReader]

    """
    Get the top reader badge based on badge ID
    """
    topReaderBadgeById(id: ID!): UserTopReader
  }

  extend type Mutation {
    """
    Update user profile information
    """
    updateUserProfile(data: UpdateUserInput, upload: Upload): User @auth

    """
    Hide user's read history
    """
    hideReadHistory(postId: String!, timestamp: DateTime!): EmptyResponse @auth

    """
    Delete user's account
    """
    deleteUser: EmptyResponse @auth

    """
    The mutation to subscribe to the personalized digest
    """
    subscribePersonalizedDigest(
      """
      Preferred hour of the day. Expected value is 0-23.
      """
      hour: Int
      """
      Preferred day of the week. Expected value is 0-6
      """
      day: Int

      """
      Type of the digest (digest/reminder/etc)
      """
      type: DigestType

      """
      Send type of the digest
      """
      sendType: UserPersonalizedDigestSendType
    ): UserPersonalizedDigest @auth

    """
    The mutation to unsubscribe from the personalized digest
    """
    unsubscribePersonalizedDigest(type: DigestType): EmptyResponse @auth
    """
    The mutation to accept feature invites from another user
    """
    acceptFeatureInvite(
      """
      The token to validate whether the inviting user has access to the relevant feature
      """
      token: String!
      """
      The user id of the inviting user to cross-check token validity
      """
      referrerId: ID!
      """
      Name of the feature the user is getting invited to
      """
      feature: String!
    ): EmptyResponse @auth

    """
    Upload a new profile cover image
    """
    uploadCoverImage(
      """
      Asset to upload
      """
      image: Upload!
    ): User! @auth @rateLimit(limit: 5, duration: 60)

    """
    Update the user's readme
    """
    updateReadme(
      """
      The readme content
      """
      content: String!
    ): User! @auth

    """
    Stores user source tracking information
    """
    addUserAcquisitionChannel(acquisitionChannel: String!): EmptyResponse @auth

    """
    Store user company
    """
    addUserCompany(email: String!): EmptyResponse
      @auth
      @rateLimit(limit: 5, duration: 3600)

    """
    Clear user company
    """
    removeUserCompany(email: String!): EmptyResponse @auth

    """
    Verify a user company code
    """
    verifyUserCompanyCode(email: String!, code: String!): UserCompany
      @auth
      @rateLimit(limit: 5, duration: 3600)

    """
    Clears the user marketing CTA and marks it as read
    """
    clearUserMarketingCta(campaignId: String!): EmptyResponse @auth

    """
    Vote entity
    """
    vote(
      """
      Id of the entity
      """
      id: ID!

      """
      Entity to vote (post, comment..)
      """
      entity: UserVoteEntity!

      """
      Vote type
      """
      vote: Int!
    ): EmptyResponse @auth

    """
    When a user tries to report an entity. The entity can be either post/comment/source or user when we get there
    """
    sendReport(
      """
      The entity the user is trying to report
      """
      type: ReportEntity!
      """
      The id of the entity the user is trying to report
      """
      id: ID!
      """
      The reason the user is reporting the entity
      """
      reason: ReportReason!
      """
      Additional information the user wants to provide
      """
      comment: String
      """
      Tags associated with the report
      """
      tags: [String]
    ): EmptyResponse @auth

    """
    Update the user's streak configuration
    """
    updateStreakConfig(weekStart: Int): UserStreak @auth

    """
    Restore user's streak
    """
    recoverStreak: UserStreak @auth
  }
`;

const getCurrentUser = (
  ctx: Context,
  info: GraphQLResolveInfo,
): Promise<GQLUser> =>
  graphorm.queryOneOrFail<GQLUser>(ctx, info, (builder) => ({
    ...builder,
    queryBuilder: builder.queryBuilder.where(`"${builder.alias}"."id" = :id`, {
      id: ctx.userId,
    }),
  }));

export const getUserReadHistory = async ({
  con,
  userId,
  after,
  before,
}: {
  con: DataSource;
  userId: string;
  after: Date;
  before: Date;
}) => {
  return con
    .getRepository(ActiveView)
    .createQueryBuilder('view')
    .select(`date_trunc('day', ${timestampAtTimezone})::date::text`, 'date')
    .addSelect(`count(*) AS "reads"`)
    .innerJoin(User, 'user', 'user.id = view.userId')
    .where('view.userId = :userId', { userId })
    .andWhere('view.timestamp >= :after', { after })
    .andWhere('view.timestamp < :before', { before })
    .groupBy('date')
    .orderBy('date')
    .getRawMany();
};

interface ReadingHistyoryArgs {
  id: string;
  after: string;
  before: string;
  limit?: number;
}

interface userStreakProfileArgs {
  id: string;
}

const readHistoryResolver = async (
  args: ConnectionArguments & { query?: string; isPublic?: boolean },
  ctx: Context,
  info: GraphQLResolveInfo,
): Promise<Connection<GQLView>> => {
  const user = await ctx.con
    .getRepository(User)
    .findOneByOrFail({ id: ctx.userId });
  const queryBuilder = (builder: GraphORMBuilder): GraphORMBuilder => {
    builder.queryBuilder = builder.queryBuilder
      .andWhere(`"${builder.alias}"."userId" = :userId`, {
        userId: ctx.userId,
      })
      .andWhere(`"${builder.alias}"."hidden" = false`)
      .innerJoin(Post, 'p', `"${builder.alias}"."postId" = p.id`)
      .addSelect(
        `"timestamp"::timestamptz at time zone '${user.timezone ?? 'utc'}'`,
        'timestamp',
      )
      .addSelect('timestamp', 'timestampDb')
      .andWhere('p.visible = true')
      .andWhere('p.deleted = false');

    if (args?.query) {
      builder.queryBuilder.andWhere(`p.tsv @@ (${getSearchQuery(':query')})`, {
        query: processSearchQuery(args.query),
      });
    }
    if (args?.isPublic) {
      builder.queryBuilder.andWhere(`p.private = false`);
    }

    return builder;
  };

  return queryPaginatedByDate(
    ctx,
    info,
    args,
    { key: 'timestamp' },
    { queryBuilder, orderByKey: 'DESC' },
  );
};

const userTimezone = `at time zone COALESCE(timezone, 'utc')`;
const timestampAtTimezone = `"timestamp"::timestamptz ${userTimezone}`;

const MAX_README_LENGTH = 10_000;

export const getMarketingCta = async (
  con: DataSource | QueryRunner,
  log: FastifyBaseLogger,
  userId: string,
) => {
  if (!userId) {
    log.info('no userId provided when fetching marketing cta');
    return null;
  }

  const redisKey = generateStorageKey(
    StorageTopic.Boot,
    StorageKey.MarketingCta,
    userId,
  );
  const rawRedisValue = await getRedisObject(redisKey);

  if (rawRedisValue === RedisMagicValues.SLEEPING) {
    return null;
  }

  // If the vale in redis is `EMPTY`, we fallback to `null`
  const marketingCta: MarketingCta | null = rawRedisValue
    ? JSON.parse(rawRedisValue)
    : null;
  if (marketingCta?.flags?.image) {
    marketingCta.flags.image = mapCloudinaryUrl(marketingCta.flags.image);
  }
  return marketingCta || cachePrefillMarketingCta(con, userId);
};

const getUserStreakQuery = async (
  id: string,
  ctx: Context,
  info: GraphQLResolveInfo,
) => {
  return await graphorm.queryOne<GQLUserStreakTz>(ctx, info, (builder) => ({
    ...builder,
    queryBuilder: builder.queryBuilder
      .addSelect(
        `(date_trunc('day', "${builder.alias}"."lastViewAt" at time zone COALESCE(u.timezone, 'utc'))::date) AS "lastViewAtTz"`,
      )
      .addSelect('u.id', 'userId')
      .addSelect('u.timezone', 'timezone')
      .addSelect('u."weekStart"', 'weekStart')
      .innerJoin(User, 'u', `"${builder.alias}"."userId" = u.id`)
      .where(`"${builder.alias}"."userId" = :id`, {
        id: id,
      }),
  }));
};

const getUserCompanies = async (
  _: unknown,
  ctx: Context,
  info: GraphQLResolveInfo,
) => {
  return await graphorm.query<GQLUserCompany>(
    ctx,
    info,
    (builder) => {
      builder.queryBuilder = builder.queryBuilder
        .andWhere(`${builder.alias}."userId" = :userId`, {
          userId: ctx.userId,
        })
        .andWhere(`${builder.alias}."verified" = true`);

      return builder;
    },
    true,
  );
};

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    whoami: async (_, __, ctx: AuthContext, info: GraphQLResolveInfo) => {
      const res = await graphorm.query<GQLUser>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder = builder.queryBuilder
            .andWhere(`${builder.alias}.id = :id`, { id: ctx.userId })
            .limit(1);
          return builder;
        },
        true,
      );
      if (!res[0]) {
        throw new NotFoundError('user not found');
      }
      return res[0];
    },
    userStats: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLUserStats | null> => {
      const [postStats, commentStats, numFollowing, numFollowers] =
        await Promise.all([
          getAuthorPostStats(ctx.con, id),
          ctx.con
            .createQueryBuilder()
            .select('count(*)', 'numComments')
            .addSelect('sum(comment.upvotes)', 'numCommentUpvotes')
            .from(Comment, 'comment')
            .where({ userId: id })
            .innerJoin(Post, 'p', `comment.postId = p.id`)
            .andWhere('p.visible = true')
            .andWhere('p.deleted = false')
            .getRawOne(),
          ctx.con.getRepository(ContentPreferenceUser).countBy({
            userId: id,
            status: In([
              ContentPreferenceStatus.Follow,
              ContentPreferenceStatus.Subscribed,
            ]),
          }),
          ctx.con.getRepository(ContentPreferenceUser).countBy({
            referenceUserId: id,
            status: In([
              ContentPreferenceStatus.Follow,
              ContentPreferenceStatus.Subscribed,
            ]),
          }),
        ]);
      return {
        numPosts: postStats?.numPosts ?? 0,
        numComments: commentStats?.numComments ?? 0,
        numPostViews: postStats?.numPostViews ?? 0,
        numPostUpvotes: postStats?.numPostUpvotes ?? 0,
        numCommentUpvotes: commentStats?.numCommentUpvotes ?? 0,
        numFollowing,
        numFollowers,
      };
    },
    user: async (
      _,
      { id }: { id: string },
      ctx: Context,
      info: GraphQLResolveInfo,
    ): Promise<GQLUser> => {
      const res = await graphorm.query<GQLUser>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder = builder.queryBuilder
            .andWhere(
              `("${builder.alias}"."id" = :id OR "${builder.alias}"."username" = :id)`,
              { id },
            )
            .limit(1);
          return builder;
        },
        true,
      );
      if (!res[0]) {
        throw new ForbiddenError('user not found');
      }
      return res[0];
    },
    userReadingRank: async (
      _,
      { id, version = 1, limit = 6 }: ReadingRankArgs,
      ctx: Context,
    ): Promise<GQLReadingRank> => {
      const isSameUser = ctx.userId === id;
      const user = await ctx.con.getRepository(User).findOneByOrFail({ id });
      const rank = await getUserReadingRank(
        ctx.con,
        id,
        user?.timezone,
        version,
        limit,
      );

      return isSameUser ? rank : { currentRank: rank.currentRank };
    },
    userMostReadTags: async (
      _,
      { id, before, after, limit = 5 }: ReadingHistyoryArgs,
      ctx: Context,
    ): Promise<GQLMostReadTag[]> => {
      const start = after ?? new Date(0).toISOString();
      const end = before ?? new Date().toISOString();
      const user = await ctx.con.getRepository(User).findOneByOrFail({ id });

      return getMostReadTags(ctx.con, {
        limit,
        userId: user.id,
        dateRange: { start, end },
      });
    },
    userReadingRankHistory: async (
      _,
      { id, before, after, version = 1 }: ReadingRankArgs & ReadingHistyoryArgs,
      ctx: Context,
    ): Promise<GQLReadingRankHistory[]> => {
      const start = after ?? new Date(0).toISOString();
      const end = before ?? new Date().toISOString();
      const rankColumn =
        version > 1 ? 'days' : 'case when days < 3 then 0 else days - 2 end';

      return ctx.con.query(
        `
          select ${rankColumn} as "rank",
                 count(*)      as "count"
          from (select date_trunc('week', ${timestampAtTimezone}) ${userTimezone} as "timestamp", count(*) as days
                from (select date_trunc('day', ${timestampAtTimezone}) ${userTimezone} as "timestamp", min("user".timezone) as "timezone"
                      from "view"
                             join "user" on "user".id = view."userId"
                      where "userId" = $1
                        and "timestamp" >= $2
                        and "timestamp" < $3
                      group by 1
                      having count(*) > 0) as days
                group by 1) as weeks
          group by 1;
        `,
        [id, start, end],
      );
    },
    userReadHistory: async (
      source,
      { id, after, before }: ReadingHistyoryArgs,
      ctx: Context,
    ): Promise<GQLReadingRankHistory[]> =>
      getUserReadHistory({
        con: ctx.con,
        userId: id,
        after: new Date(after),
        before: new Date(before),
      }),
    userStreak: async (
      _,
      __,
      ctx: AuthContext,
      info,
    ): Promise<GQLUserStreak> => {
      const streak = await getUserStreakQuery(ctx.userId, ctx, info);

      if (!streak) {
        return {
          max: 0,
          total: 0,
          current: 0,
          userId: ctx.userId,
          weekStart: DayOfWeek.Monday,
        };
      }

      const hasClearedStreak = await checkAndClearUserStreak(
        ctx.con,
        info,
        streak,
      );
      if (hasClearedStreak) {
        return { ...streak, current: 0 };
      }

      return streak;
    },
    userStreakProfile: async (
      _,
      { id }: userStreakProfileArgs,
      ctx: Context,
      info,
    ): Promise<GQLUserStreak> => {
      const streak = await getUserStreakQuery(id, ctx, info);

      if (!streak) {
        return {
          max: 0,
          total: 0,
          userId: id,
          weekStart: DayOfWeek.Monday,
          current: 0,
        };
      }

      return streak;
    },
    streakRecover: async (
      _,
      __,
      ctx: AuthContext,
    ): Promise<StreakRecoverQueryResult> => {
      const { userId } = ctx;

      const [streak, oldStreakLength] = await Promise.all([
        await ctx.con.getRepository(UserStreak).findOneBy({
          userId,
        }),
        await getRestoreStreakCache({ userId }),
      ]);
      const timeForRecoveryPassed = !!streak && streak.currentStreak > 1;

      if (!oldStreakLength || timeForRecoveryPassed) {
        return {
          canRecover: false,
          cost: 0,
          oldStreakLength: 0,
        };
      }

      const hasRecord = await ctx.con.getRepository(UserStreakAction).existsBy({
        userId,
        type: UserStreakActionType.Recover,
      });
      const cost = hasRecord
        ? reputationReasonAmount[ReputationReason.StreakRecover]
        : reputationReasonAmount[ReputationReason.StreakFirstRecovery];

      return {
        canRecover: true,
        oldStreakLength,
        cost: Math.abs(cost),
      };
    },
    userReads: async (): Promise<number> => {
      // Kept for backwards compatability
      return 0;
    },
    searchReadingHistorySuggestions: async (
      source,
      { query }: { query: string },
      ctx: Context,
    ) => {
      const hits: { title: string }[] = await ctx.con.query(
        `
          WITH search AS (${getSearchQuery('$2')})
          select distinct(ts_headline(title, search.query,
                                      ('StartSel = <strong>, StopSel = </strong>'))) as title
          from post
                 INNER JOIN view
                            ON view."postId" = post.id AND view."userId" = $1,
               search
          where tsv @@ search.query
            and post.visible = true
            and post.deleted = false
          order by title desc
            limit 5;
        `,
        [ctx.userId, processSearchQuery(query)],
      );
      return {
        query,
        hits,
      };
    },
    searchReadingHistory: async (
      source,
      args: ConnectionArguments & { query: string },
      ctx: AuthContext,
      info,
    ): Promise<Connection<GQLView>> => readHistoryResolver(args, ctx, info),
    readHistory: async (
      _,
      args: ConnectionArguments & { isPublic?: boolean },
      ctx: Context,
      info,
    ): Promise<Connection<GQLView>> => readHistoryResolver(args, ctx, info),
    generateUniqueUsername: async (
      _,
      args: { name: string },
      ctx: AuthContext,
    ): Promise<string> => {
      const name = args.name.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');

      if (name.length === 0) {
        return '';
      }

      const username = name.substring(0, 39);
      let generatedUsernames = [username];

      for (let i = 0; i < 4; i++) {
        const random = randomInt(100);
        const randomUsername = `${username.substring(0, 37)}${random}`;
        generatedUsernames.push(randomUsername);
      }

      const [usernameChecks, disallowHandles] = await Promise.all([
        ctx.getRepository(User).find({
          where: { username: In(generatedUsernames) },
          select: ['username'],
        }),
        ctx.getRepository(DisallowHandle).find({
          where: { value: In(generatedUsernames) },
          select: ['value'],
        }),
      ]);

      const disallowedUsernames = [...usernameChecks, ...disallowHandles].map(
        (handle) => {
          if (handle instanceof User) {
            return handle.username;
          }
          return handle.value;
        },
      );

      generatedUsernames = generatedUsernames.filter(
        (item) => !disallowedUsernames.includes(item),
      );

      if (generatedUsernames.length === 0) {
        ctx.log.info('usernameChecks', usernameChecks);
        return '';
      }

      return generatedUsernames[0];
    },
    referralCampaign: async (
      source,
      args: { referralOrigin: string },
      ctx: AuthContext,
    ): Promise<ReferralCampaign> => {
      const { referralOrigin } = args;
      const userRepo = ctx.getRepository(User);

      const userInvite = await ctx.getRepository(Invite).findOneBy({
        userId: ctx.userId,
        campaign: referralOrigin as CampaignType,
      });

      const campaignUrl = getInviteLink({
        referralOrigin,
        userId: ctx.userId,
        token: userInvite?.token,
      });

      const [referredUsersCount, url] = await Promise.all([
        userInvite?.count ||
          userRepo.count({
            where: { referralId: ctx.userId, referralOrigin },
          }),
        getShortUrl(campaignUrl.toString(), ctx.log),
      ]);

      return {
        referredUsersCount,
        referralCountLimit: userInvite?.limit,
        referralToken: userInvite?.token,
        url,
      };
    },
    personalizedDigest: async (
      _,
      __,
      ctx: AuthContext,
      info,
    ): Promise<GQLUserPersonalizedDigest[]> => {
      const personalizedDigest =
        await graphorm.query<GQLUserPersonalizedDigest>(
          ctx,
          info,
          (builder) => {
            builder.queryBuilder = builder.queryBuilder.andWhere(
              '"userId" = :userId',
              { userId: ctx.userId },
            );

            return builder;
          },
          true,
        );

      if (personalizedDigest.length === 0) {
        throw new NotFoundError('Not subscribed to personalized digest');
      }

      return personalizedDigest;
    },
    companies: async (
      _,
      __,
      ctx: AuthContext,
      info,
    ): Promise<GQLUserCompany[]> => getUserCompanies(_, ctx, info),
    referredUsers: async (
      _,
      args: ConnectionArguments,
      ctx: AuthContext,
      info,
    ): Promise<Connection<GQLUser>> => {
      return queryPaginatedByDate(
        ctx,
        info,
        args,
        { key: 'createdAt' },
        {
          queryBuilder: (builder) => {
            builder.queryBuilder = builder.queryBuilder.andWhere(
              `${builder.alias}."referralId" = :id`,
              {
                id: ctx.userId,
              },
            );
            return builder;
          },
          orderByKey: 'DESC',
        },
      );
    },
    userIntegrations: async (
      _,
      args: ConnectionArguments,
      ctx: AuthContext,
      info,
    ): Promise<Connection<GQLUserIntegration>> => {
      return queryPaginatedByDate(
        ctx,
        info,
        args,
        { key: 'createdAt' } as GQLDatePageGeneratorConfig<
          GQLUserIntegration,
          'createdAt'
        >,
        {
          queryBuilder: (builder) => {
            builder.queryBuilder = builder.queryBuilder.andWhere(
              `${builder.alias}."userId" = :integrationUserId`,
              {
                integrationUserId: ctx.userId,
              },
            );
            return builder;
          },
          orderByKey: 'DESC',
        },
      );
    },
    userIntegration: async (
      _,
      { id }: { id: string },
      ctx: AuthContext,
      info: GraphQLResolveInfo,
    ): Promise<GQLUserIntegration> => {
      return graphorm.queryOneOrFail<GQLUserIntegration>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder = builder.queryBuilder.andWhere(
            `${builder.alias}."id" = :id`,
            {
              id,
            },
          );
          builder.queryBuilder = builder.queryBuilder.andWhere(
            `${builder.alias}."userId" = :userId`,
            { userId: ctx.userId },
          );
          return builder;
        },
      );
    },
    topReaderBadge: async (
      _,
      { limit = 5, userId }: { limit: number; userId: string },
      ctx: AuthContext,
      info: GraphQLResolveInfo,
    ) => {
      return graphorm.query<GQLUserTopReader>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder = builder.queryBuilder
            .andWhere(`${builder.alias}.userId = :userId`, {
              userId,
            })
            .orderBy({
              '"issuedAt"': 'DESC',
            })
            .limit(limit);
          return builder;
        },
        true,
      );
    },
    topReaderBadgeById: async (
      _,
      { id }: { id: string },
      ctx: AuthContext,
      info: GraphQLResolveInfo,
    ) => {
      return graphorm.queryOneOrFail<GQLUserTopReader>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder = builder.queryBuilder.andWhere(
            `${builder.alias}.id = :id`,
            { id },
          );
          return builder;
        },
        'top reader badge',
        true,
      );
    },
  },
  Mutation: {
    updateUserProfile: async (
      _,
      { data, upload }: GQLUserParameters,
      ctx: AuthContext,
    ): Promise<GQLUser> => {
      const repo = ctx.con.getRepository(User);
      const user = await repo.findOneBy({ id: ctx.userId });

      if (!user) {
        throw new AuthenticationError('Unauthorized!');
      }

      if (!ctx.service) {
        // Only accept email changes from Service calls
        delete data.email;
        delete data.infoConfirmed;
      }
      data = await validateUserUpdate(user, data, ctx.con);

      const avatar =
        !!upload && process.env.CLOUDINARY_URL
          ? (await uploadAvatar(user.id, (await upload).createReadStream())).url
          : data.image || user.image;

      try {
        const updatedUser = { ...user, ...data, image: avatar };
        updatedUser.email = updatedUser.email?.toLowerCase();
        if (
          !user.infoConfirmed &&
          updatedUser.email &&
          updatedUser.username &&
          updatedUser.name
        ) {
          updatedUser.infoConfirmed = true;
        }
        return await ctx.con.getRepository(User).save(updatedUser);
      } catch (originalError) {
        const err = originalError as TypeORMQueryFailedError;

        if (err.code === TypeOrmError.DUPLICATE_ENTRY) {
          const uniqueColumns: Array<keyof User> = [
            'username',
            'github',
            'twitter',
            'hashnode',
            'roadmap',
            'threads',
            'codepen',
            'reddit',
            'stackoverflow',
            'youtube',
            'linkedin',
            'mastodon',
          ];

          uniqueColumns.forEach((uniqueColumn) => {
            if (err.message.indexOf(`users_${uniqueColumn}_unique`) > -1) {
              throw new ValidationError(
                JSON.stringify({
                  [uniqueColumn]: `${uniqueColumn} already exists`,
                }),
              );
            }
          });
        }
        throw err;
      }
    },
    deleteUser: async (_, __, ctx: AuthContext): Promise<unknown> => {
      const userId = ctx.userId;
      return await deleteUser(ctx.con, ctx.log, userId);
    },
    hideReadHistory: (
      _,
      { postId, timestamp }: { postId?: string; timestamp: Date },
      ctx: AuthContext,
    ): Promise<unknown> =>
      ctx
        .getRepository(View)
        .createQueryBuilder()
        .update()
        .set({ hidden: true })
        .where('"postId" = :postId', { postId })
        .andWhere(
          `date_trunc('second', "timestamp"::timestamp) = date_trunc('second', :param::timestamp)`,
          { param: timestamp },
        )
        .andWhere('"userId" = :userId', { userId: ctx.userId })
        .execute(),
    subscribePersonalizedDigest: async (
      _,
      args: {
        hour?: number;
        day?: number;
        type?: UserPersonalizedDigestType;
        sendType?: UserPersonalizedDigestSendType;
      },
      ctx: AuthContext,
    ): Promise<GQLUserPersonalizedDigest> => {
      const {
        hour,
        day,
        type = UserPersonalizedDigestType.Digest,
        sendType = UserPersonalizedDigestSendType.workdays,
      } = args;

      if (!isNullOrUndefined(hour) && (hour < 0 || hour > 23)) {
        throw new ValidationError('Invalid hour');
      }

      if (!isNullOrUndefined(day) && (day < 0 || day > 6)) {
        throw new ValidationError('Invalid day');
      }

      const repo = ctx.con.getRepository(UserPersonalizedDigest);

      const flags: UserPersonalizedDigestFlags = {};
      if (sendType) {
        flags.sendType = sendType;
      }

      const personalizedDigest = await repo.save({
        userId: ctx.userId,
        preferredDay: day,
        preferredHour: hour,
        type,
        flags,
      });

      await Promise.all([
        resubscribeUser(cio, ctx.userId),
        identifyUserPersonalizedDigest({
          userId: ctx.userId,
          cio,
          subscribed: true,
        }),
      ]);

      return personalizedDigest;
    },
    unsubscribePersonalizedDigest: async (
      _,
      {
        type = UserPersonalizedDigestType.Digest,
      }: { type?: UserPersonalizedDigestType },
      ctx: AuthContext,
    ): Promise<unknown> => {
      const repo = ctx.con.getRepository(UserPersonalizedDigest);

      if (ctx.userId) {
        await repo.delete({
          userId: ctx.userId,
          type,
        });
      }

      await identifyUserPersonalizedDigest({
        userId: ctx.userId,
        cio,
        subscribed: false,
      });

      return { _: true };
    },
    acceptFeatureInvite: async (
      _,
      {
        token,
        referrerId,
        feature,
      }: {
        token: string;
        referrerId: string;
        feature: string;
      },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const referrerInvite = await ctx.con
        .getRepository(Invite)
        .findOneByOrFail({
          userId: referrerId,
          token: token,
          campaign: feature as CampaignType,
        });

      if (referrerInvite.count >= referrerInvite.limit) {
        throw new ValidationError(SubmissionFailErrorKeys.InviteLimitReached);
      }

      await ctx.con.transaction(async (entityManager): Promise<void> => {
        try {
          await entityManager.getRepository(Feature).insert({
            userId: ctx.userId,
            feature: feature as FeatureType,
            invitedById: referrerId,
            value: FeatureValue.Allow,
          });
        } catch (originalError) {
          const err = originalError as TypeORMQueryFailedError;

          if (err.code === TypeOrmError.DUPLICATE_ENTRY) return;
          throw err;
        }

        await entityManager.getRepository(Invite).update(
          { token: token },
          {
            count: referrerInvite.count + 1,
          },
        );
      });

      return { _: true };
    },
    uploadCoverImage: async (
      _,
      { image }: { image: Promise<FileUpload> },
      ctx: AuthContext,
      info,
    ): Promise<GQLUser> => {
      if (!image) {
        throw new ValidationError('File is missing!');
      }

      if (!process.env.CLOUDINARY_URL) {
        throw new Error('Unable to upload asset to cloudinary!');
      }

      const upload = await image;
      const { url: imageUrl } = await uploadProfileCover(
        ctx.userId,
        upload.createReadStream(),
      );
      await ctx.con
        .getRepository(User)
        .update({ id: ctx.userId }, { cover: imageUrl });
      return getCurrentUser(ctx, info);
    },
    updateReadme: async (
      _,
      { content }: { content: string },
      ctx: AuthContext,
      info,
    ): Promise<GQLUser> => {
      if (content.length >= MAX_README_LENGTH) {
        throw new ValidationError(`Max content length is ${MAX_README_LENGTH}`);
      }
      const contentHtml = markdown.render(content);
      await ctx.con
        .getRepository(User)
        .update(
          { id: ctx.userId },
          { readme: content, readmeHtml: contentHtml },
        );
      return getCurrentUser(ctx, info);
    },
    addUserAcquisitionChannel: async (
      _,
      { acquisitionChannel }: { acquisitionChannel: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const maxLength = 50;
      if (acquisitionChannel?.length > maxLength) {
        throw new ValidationError(
          `Max Acquisition Channel length is ${maxLength}`,
        );
      }

      await ctx.con
        .getRepository(User)
        .update({ id: ctx.userId }, { acquisitionChannel });

      return { _: true };
    },
    addUserCompany: async (
      _,
      { email }: { email: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      if (!email?.length) {
        throw new ValidationError('Email is required');
      }
      if (!email!.match(emailRegex) || email.length > 200) {
        throw new ValidationError('Invalid email');
      }

      const domain = email.toLowerCase().split('@')[1];
      if (validateWorkEmailDomain(domain)) {
        throw new ValidationError('We can only verify unique company domains');
      }

      const code = await generateVerifyCode();

      const existingUserCompanyEmail = await ctx.con
        .getRepository(UserCompany)
        .findOneBy({
          email,
        });

      if (existingUserCompanyEmail) {
        if (existingUserCompanyEmail.userId !== ctx.userId) {
          throw new ValidationError(
            'Oops, there was an issue verifying this email. Please use a different one.',
          );
        }

        if (existingUserCompanyEmail.verified === true) {
          throw new ValidationError('This email has already been verified');
        }

        const updatedRecord = { ...existingUserCompanyEmail, code };
        await ctx.con.getRepository(UserCompany).save(updatedRecord);
      } else {
        const company = await ctx.con.getRepository(Company).findOneBy({
          domains: ArrayContains([domain]),
        });

        await ctx.con.getRepository(UserCompany).insert({
          email,
          code,
          userId: ctx.userId,
          companyId: company?.id ?? null,
        });
      }

      await sendEmail({
        send_to_unsubscribed: true,
        transactional_message_id:
          CioTransactionalMessageTemplateId.VerifyCompany,
        message_data: {
          code,
        },
        identifiers: {
          id: ctx.userId,
        },
        to: email,
      });

      return { _: true };
    },
    removeUserCompany: async (
      _,
      { email }: { email: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con
        .getRepository(UserCompany)
        .delete({ email, userId: ctx.userId });

      return { _: true };
    },
    verifyUserCompanyCode: async (
      _,
      { email, code }: { email: string; code: string },
      ctx: AuthContext,
      info,
    ): Promise<GQLUserCompany> => {
      const userCompany = await ctx.con
        .getRepository(UserCompany)
        .findOneByOrFail({
          email,
          userId: ctx.userId,
          verified: false,
        });

      if (userCompany.code !== code) {
        throw new ValidationError('Invalid code');
      }

      const updatedRecord = { ...userCompany, verified: true };
      await ctx.con.getRepository(UserCompany).save(updatedRecord);

      return await graphorm.queryOneOrFail<GQLUserCompany>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder = builder.queryBuilder
            .andWhere(`${builder.alias}."userId" = :userId`, {
              userId: ctx.userId,
            })
            .andWhere(`${builder.alias}."email" = :email`, { email })
            .andWhere(`${builder.alias}."verified" = true`);

          return builder;
        },
      );
    },
    clearUserMarketingCta: async (
      _,
      { campaignId }: { campaignId: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const updateResult = await ctx.con
        .getRepository(UserMarketingCta)
        .update(
          { userId: ctx.userId, marketingCtaId: campaignId, readAt: IsNull() },
          { readAt: new Date() },
        );

      const affected = updateResult.affected || 0;

      if (affected > 0) {
        await deleteRedisKey(
          generateStorageKey(
            StorageTopic.Boot,
            StorageKey.MarketingCta,
            ctx.userId,
          ),
        );

        // Preemptively fetch the next CTA and store it in Redis
        await getMarketingCta(ctx.con, ctx.log, ctx.userId);
      }

      return { _: true };
    },
    vote: async (
      _,
      {
        id,
        vote,
        entity,
      }: { id: string; vote: UserVote; entity: UserVoteEntity },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      switch (entity) {
        case UserVoteEntity.Post:
          return votePost({ ctx, id, vote });
        case UserVoteEntity.Comment:
          return voteComment({ ctx, id, vote });
        default:
          throw new ValidationError('Unsupported vote entity');
      }
    },
    updateStreakConfig: async (
      _,
      { weekStart }: { weekStart: number },
      ctx: AuthContext,
      info,
    ): Promise<GQLUserStreak> => {
      if (VALID_WEEK_STARTS.indexOf(weekStart) === -1) {
        throw new ValidationError('Invalid week start');
      }

      await ctx.con.getRepository(User).findOneByOrFail({ id: ctx.userId });

      const streak = await getUserStreakQuery(ctx.userId, ctx, info);

      if (!streak) {
        throw new NotFoundError('User streak not found');
      }

      await ctx.con
        .getRepository(User)
        .update({ id: ctx.userId }, { weekStart });

      return {
        ...streak,
        weekStart,
      };
    },
    recoverStreak: async (
      _,
      __,
      ctx: AuthContext,
      info,
    ): Promise<GQLUserStreak> => {
      const { userId } = ctx;

      const oldStreakLength = await getRestoreStreakCache({ userId });
      if (!oldStreakLength) {
        throw new ValidationError('No streak to recover');
      }

      const streak = await getUserStreakQuery(userId, ctx, info);
      const hasNoStreakOrCurrentIsGreaterThanOne =
        !streak || streak.current > 1;
      if (hasNoStreakOrCurrentIsGreaterThanOne) {
        throw new ValidationError('Time to recover streak has passed');
      }

      const [user, hasRecord] = await Promise.all([
        ctx.con.getRepository(User).findOneByOrFail({ id: userId }),
        ctx.con.getRepository(UserStreakAction).existsBy({
          userId,
          type: UserStreakActionType.Recover,
        }),
      ]);
      const recoverCost = hasRecord
        ? reputationReasonAmount[ReputationReason.StreakRecover]
        : reputationReasonAmount[ReputationReason.StreakFirstRecovery];
      const userCanAfford = user.reputation >= Math.abs(recoverCost);

      if (!userCanAfford) {
        throw new ConflictError('Not enough reputation to recover streak');
      }

      const reputationEvent = {
        grantToId: userId,
        targetId: format(new Date(), 'dd-MM-yyyy'),
        targetType: ReputationType.Streak,
        reason: hasRecord
          ? ReputationReason.StreakRecover
          : ReputationReason.StreakFirstRecovery,
        amount: recoverCost,
      };

      const currentStreak = oldStreakLength + streak.current;
      const maxStreak = Math.max(currentStreak, streak.max ?? 0);

      await ctx.con.transaction(async (manager) => {
        const transactions = [
          manager.getRepository(ReputationEvent).save(reputationEvent),
          manager.getRepository(UserStreakAction).save({
            userId,
            type: UserStreakActionType.Recover,
          }),
          manager.getRepository(UserStreak).update(
            { userId },
            {
              currentStreak,
              maxStreak,
              updatedAt: new Date(),
            },
          ),
          manager
            .getRepository(Alerts)
            .update({ userId }, { showRecoverStreak: false }),
        ];

        await Promise.all(transactions);

        const cacheKey = generateStorageKey(
          StorageTopic.Streak,
          StorageKey.Reset,
          userId,
        );
        await deleteRedisKey(cacheKey);
      });

      return { ...streak, current: currentStreak, max: maxStreak };
    },
    sendReport: async (
      _,
      { type, ...args }: SendReportArgs,
      ctx: AuthContext,
    ) => {
      const reportCommand = reportFunctionMap[type];

      if (!reportCommand) {
        throw new ValidationError('Unsupported report entity');
      }

      return reportCommand({ ...args, ctx });
    },
  },
  User: {
    image: (user: GQLUser): GQLUser['image'] => mapCloudinaryUrl(user.image),
    cover: (user: GQLUser): GQLUser['cover'] => mapCloudinaryUrl(user.cover),
    permalink: getUserPermalink,
  },
  UserIntegration: {
    name: (userIntegration: UserIntegration) => {
      switch (userIntegration.type) {
        case UserIntegrationType.Slack: {
          const slackIntegration = userIntegration as UserIntegrationSlack;

          return (
            slackIntegration.meta.teamName ?? `Slack ${slackIntegration.id}`
          );
        }
        default:
          return userIntegration.type;
      }
    },
  },
  UserTopReader: {
    image: (topReader: GQLUserTopReader): GQLUserTopReader['image'] =>
      mapCloudinaryUrl(topReader.image),
  },
});
