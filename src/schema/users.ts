import { isNullOrUndefined } from './../common/object';
import { getMostReadTags } from './../common/devcard';
import { GraphORMBuilder } from '../graphorm/graphorm';
import { Connection, ConnectionArguments } from 'graphql-relay';
import {
  Comment,
  Feature,
  FeatureType,
  FeatureValue,
  Post,
  PostStats,
  User,
  validateUserUpdate,
  View,
  CampaignType,
  Invite,
  UserPersonalizedDigest,
  getAuthorPostStats,
  AcquisitionChannel,
  UserMarketingCta,
  MarketingCta,
  UserPersonalizedDigestType,
  UserPersonalizedDigestFlags,
  UserPersonalizedDigestSendType,
} from '../entity';
import {
  AuthenticationError,
  ForbiddenError,
  ValidationError,
} from 'apollo-server-errors';
import { IResolvers } from '@graphql-tools/utils';
import { FileUpload } from 'graphql-upload/GraphQLUpload.js';
import { Context } from '../Context';
import { traceResolverObject } from './trace';
import { queryPaginatedByDate } from '../common/datePageGenerator';
import {
  getInviteLink,
  getShortUrl,
  getUserReadingRank,
  GQLUserStreak,
  TagsReadingStatus,
  uploadAvatar,
  uploadProfileCover,
  checkAndClearUserStreak,
  GQLUserStreakTz,
  toGQLEnum,
  getUserPermalink,
  votePost,
  voteComment,
} from '../common';
import { getSearchQuery, GQLEmptyResponse, processSearchQuery } from './common';
import { ActiveView } from '../entity/ActiveView';
import graphorm from '../graphorm';
import { GraphQLResolveInfo } from 'graphql';
import {
  NotFoundError,
  SubmissionFailErrorKeys,
  TypeOrmError,
} from '../errors';
import { deleteUser } from '../directive/user';
import { randomInt } from 'crypto';
import { DataSource, In, IsNull } from 'typeorm';
import { DisallowHandle } from '../entity/DisallowHandle';
import { DayOfWeek, UserVote, UserVoteEntity } from '../types';
import { markdown } from '../common/markdown';
import {
  ONE_WEEK_IN_SECONDS,
  RedisMagicValues,
  deleteRedisKey,
  getRedisObject,
  setRedisObjectWithExpiry,
} from '../redis';
import { StorageKey, StorageTopic, generateStorageKey } from '../config';
import { FastifyBaseLogger } from 'fastify';

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
  hashnode?: string;
  portfolio?: string;
  acceptedMarketing?: boolean;
  notificationEmail?: boolean;
  infoConfirmed?: boolean;
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
  hashnode?: string;
  portfolio?: string;
  reputation?: number;
  notificationEmail?: boolean;
  timezone?: string;
  cover?: string;
  readme?: string;
  readmeHtml?: string;
}

export interface GQLView {
  post: Post;
  timestamp: Date;
  timestampDb: Date;
}

type CommentStats = { numComments: number; numCommentUpvotes: number };

export type GQLUserStats = Omit<PostStats, 'numPostComments'> & CommentStats;

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
  referralCountLimit: number;
  referralToken: string;
  url: string;
}

export interface GQLPersonalizedDigest {
  preferredDay: DayOfWeek;
  preferredHour: number;
}

export const typeDefs = /* GraphQL */ `
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
    Preferred timezone of the user that affects data
    """
    timezone: String
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

  type PersonalizedDigest {
    preferredDay: Int!
    preferredHour: Int!
    type: DigestType
  }

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
  }

  ${toGQLEnum(AcquisitionChannel, 'AcquisitionChannel')}
  ${toGQLEnum(UserPersonalizedDigestType, 'DigestType')}

  ${toGQLEnum(UserVoteEntity, 'UserVoteEntity')}

  extend type Query {
    """
    Get user based on logged in session
    """
    whoami: User @auth
    """
    Get the statistics of the user
    """
    userStats(id: ID!): UserStats
    """
    Get User Streak
    """
    userStreak: UserStreak @auth
    """
    Get the reading rank of the user
    """
    userReadingRank(id: ID!, version: Int, limit: Int): ReadingRank
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
    Get personalized digest settings
    """
    personalizedDigest(type: DigestType): PersonalizedDigest @auth

    """
    List of users that the logged in user has referred to the platform
    """
    referredUsers: UserConnection @auth
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
    ): PersonalizedDigest @auth

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
    addUserAcquisitionChannel(
      acquisitionChannel: AcquisitionChannel!
    ): EmptyResponse @auth

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
  }
`;

const getCurrentUser = (
  ctx: Context,
  info: GraphQLResolveInfo,
): Promise<GQLUser> =>
  graphorm.queryOneOrFail<GQLUser>(ctx, info, (builder) => ({
    queryBuilder: builder.queryBuilder.where(`"${builder.alias}"."id" = :id`, {
      id: ctx.userId,
    }),
    ...builder,
  }));

interface ReadingHistyoryArgs {
  id: string;
  after: string;
  before: string;
  limit?: number;
}

const readHistoryResolver = async (
  args: ConnectionArguments & { query?: string; isPublic?: boolean },
  ctx: Context,
  info,
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
  con: DataSource,
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
  let marketingCta: MarketingCta | null = JSON.parse(rawRedisValue || null);

  // If the key is not in redis, we need to fetch it from the database
  if (!marketingCta) {
    const userMarketingCta = await con.getRepository(UserMarketingCta).findOne({
      where: { userId, readAt: IsNull() },
      order: { createdAt: 'ASC' },
      relations: ['marketingCta'],
    });

    marketingCta = userMarketingCta?.marketingCta || null;
    const redisValue = userMarketingCta
      ? JSON.stringify(marketingCta)
      : RedisMagicValues.SLEEPING;

    await setRedisObjectWithExpiry(redisKey, redisValue, ONE_WEEK_IN_SECONDS);
  }

  return marketingCta;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Query: traceResolverObject<any, any>({
    whoami: async (_, __, ctx: Context, info: GraphQLResolveInfo) => {
      const res = await graphorm.query<GQLUser>(ctx, info, (builder) => {
        builder.queryBuilder = builder.queryBuilder
          .andWhere(`${builder.alias}.id = :id`, { id: ctx.userId })
          .limit(1);
        return builder;
      });
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
      const [postStats, commentStats] = await Promise.all([
        getAuthorPostStats(ctx.con, id),
        await ctx.con
          .createQueryBuilder()
          .select('count(*)', 'numComments')
          .addSelect('sum(comment.upvotes)', 'numCommentUpvotes')
          .from(Comment, 'comment')
          .where({ userId: id })
          .innerJoin(Post, 'p', `comment.postId = p.id`)
          .andWhere('p.visible = true')
          .andWhere('p.deleted = false')
          .getRawOne(),
      ]);
      return {
        numPosts: postStats?.numPosts ?? 0,
        numComments: commentStats?.numComments ?? 0,
        numPostViews: postStats?.numPostViews ?? 0,
        numPostUpvotes: postStats?.numPostUpvotes ?? 0,
        numCommentUpvotes: commentStats?.numCommentUpvotes ?? 0,
      };
    },
    user: async (
      _,
      { id }: { id: string },
      ctx: Context,
      info: GraphQLResolveInfo,
    ): Promise<GQLUser> => {
      const res = await graphorm.query<GQLUser>(ctx, info, (builder) => {
        builder.queryBuilder = builder.queryBuilder
          .andWhere(
            `("${builder.alias}"."id" = :id OR "${builder.alias}"."username" = :id)`,
            { id },
          )
          .limit(1);
        return builder;
      });
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
    ): Promise<GQLReadingRankHistory[]> => {
      return ctx.con
        .getRepository(ActiveView)
        .createQueryBuilder('view')
        .select(`date_trunc('day', ${timestampAtTimezone})::date::text`, 'date')
        .addSelect(`count(*) AS "reads"`)
        .innerJoin(User, 'user', 'user.id = view.userId')
        .where('view.userId = :id', { id })
        .andWhere('view.timestamp >= :after', { after })
        .andWhere('view.timestamp < :before', { before })
        .groupBy('date')
        .orderBy('date')
        .getRawMany();
    },
    userStreak: async (_, __, ctx: Context, info): Promise<GQLUserStreak> => {
      const streak = await graphorm.queryOne<GQLUserStreakTz>(
        ctx,
        info,
        (builder) => ({
          queryBuilder: builder.queryBuilder
            .addSelect(
              `(date_trunc('day', "${builder.alias}"."lastViewAt" at time zone COALESCE(u.timezone, 'utc'))::date) AS "lastViewAtTz"`,
            )
            .addSelect(
              `(date_trunc('day', CURRENT_TIMESTAMP at time zone COALESCE(u.timezone, 'utc'))::date) AS "currentDateTz"`,
            )
            .addSelect('u.timezone', 'timezone')
            .innerJoin(User, 'u', `"${builder.alias}"."userId" = u.id`)
            .where(`"${builder.alias}"."userId" = :id`, { id: ctx.userId }),
          ...builder,
        }),
      );

      if (!streak) {
        return {
          max: 0,
          total: 0,
          current: 0,
          lastViewAt: null,
          userId: ctx.userId,
        };
      }

      const hasClearedStreak = await checkAndClearUserStreak(ctx, info, streak);
      if (hasClearedStreak) {
        return { ...streak, current: 0 };
      }

      return streak;
    },
    userReads: async (): Promise<number> => {
      // Kept for backwards compatability
      return 0;
    },
    searchReadingHistorySuggestions: async (
      source,
      { query }: { query: string },
      ctx,
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
      ctx,
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
      ctx: Context,
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
      ctx: Context,
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
      {
        type = UserPersonalizedDigestType.Digest,
      }: { type?: UserPersonalizedDigestType },
      ctx: Context,
    ): Promise<GQLPersonalizedDigest> => {
      const personalizedDigest = await ctx
        .getRepository(UserPersonalizedDigest)
        .findOneBy({ userId: ctx.userId, type });

      if (!personalizedDigest) {
        throw new NotFoundError('Not subscribed to personalized digest');
      }

      return personalizedDigest;
    },
    referredUsers: async (
      _,
      args: ConnectionArguments,
      ctx: Context,
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
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Mutation: traceResolverObject<any, any>({
    updateUserProfile: async (
      _,
      { data, upload }: GQLUserParameters,
      ctx,
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
        upload && process.env.CLOUDINARY_URL
          ? (await uploadAvatar(user.id, (await upload).createReadStream())).url
          : data.image || user.image;

      try {
        const updatedUser = { ...user, ...data, image: avatar };
        if (
          !user.infoConfirmed &&
          updatedUser.email &&
          updatedUser.username &&
          updatedUser.name
        ) {
          updatedUser.infoConfirmed = true;
        }
        return await ctx.con.getRepository(User).save(updatedUser);
      } catch (err) {
        if (err.code === TypeOrmError.DUPLICATE_ENTRY) {
          if (err.message.indexOf('users_username_unique') > -1) {
            throw new ValidationError(
              JSON.stringify({ username: 'username already exists' }),
            );
          }
          if (err.message.indexOf('users_twitter_unique') > -1) {
            throw new ValidationError(
              JSON.stringify({
                twitter: 'twitter handle already exists',
              }),
            );
          }
          if (err.message.indexOf('users_github_unique') > -1) {
            throw new ValidationError(
              JSON.stringify({ github: 'github handle already exists' }),
            );
          }
          if (err.message.indexOf('users_hashnode_unique') > -1) {
            throw new ValidationError(
              JSON.stringify({
                hashnode: 'hashnode handle already exists',
              }),
            );
          }
        }
        throw err;
      }
    },
    deleteUser: async (_, __, ctx: Context): Promise<unknown> => {
      const userId = ctx.userId;
      return await deleteUser(ctx.con, ctx.log, userId);
    },
    hideReadHistory: (
      _,
      { postId, timestamp }: { postId?: string; timestamp: Date },
      ctx: Context,
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
      },
      ctx: Context,
    ): Promise<GQLPersonalizedDigest> => {
      const { hour, day, type = UserPersonalizedDigestType.Digest } = args;

      if (!isNullOrUndefined(hour) && (hour < 0 || hour > 23)) {
        throw new ValidationError('Invalid hour');
      }

      if (!isNullOrUndefined(hour) && (day < 0 || day > 6)) {
        throw new ValidationError('Invalid day');
      }

      const repo = ctx.con.getRepository(UserPersonalizedDigest);

      const flags: UserPersonalizedDigestFlags = {};
      if (type === UserPersonalizedDigestType.ReadingReminder) {
        flags.sendType = UserPersonalizedDigestSendType.workdays;
      }

      const personalizedDigest = await repo.save({
        userId: ctx.userId,
        preferredDay: day,
        preferredHour: hour,
        type,
        flags,
      });

      return personalizedDigest;
    },
    unsubscribePersonalizedDigest: async (
      _,
      {
        type = UserPersonalizedDigestType.Digest,
      }: { type?: UserPersonalizedDigestType },
      ctx: Context,
    ): Promise<unknown> => {
      const repo = ctx.con.getRepository(UserPersonalizedDigest);

      if (ctx.userId) {
        await repo.delete({
          userId: ctx.userId,
          type,
        });
      }

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
      ctx: Context,
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
        } catch (err) {
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
      ctx,
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
      ctx,
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
      { acquisitionChannel }: { acquisitionChannel: AcquisitionChannel },
      ctx,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con
        .getRepository(User)
        .update({ id: ctx.userId }, { acquisitionChannel });

      return { _: null };
    },
    clearUserMarketingCta: async (
      _,
      { campaignId }: { campaignId: string },
      ctx,
    ): Promise<GQLEmptyResponse> => {
      const updateResult = await ctx.con
        .getRepository(UserMarketingCta)
        .update(
          { userId: ctx.userId, marketingCtaId: campaignId, readAt: IsNull() },
          { readAt: new Date() },
        );

      if (updateResult.affected > 0) {
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

      return { _: null };
    },
    vote: async (
      _,
      {
        id,
        vote,
        entity,
      }: { id: string; vote: UserVote; entity: UserVoteEntity },
      ctx: Context,
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
  }),
  User: {
    permalink: getUserPermalink,
  },
};
