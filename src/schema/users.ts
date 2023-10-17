import { isNullOrUndefined } from './../common/object';
import { getMostReadTags } from './../common/devcard';
import { GraphORMBuilder } from '../graphorm/graphorm';
import { Connection, ConnectionArguments } from 'graphql-relay';
import {
  Post,
  DevCard,
  User,
  Comment,
  PostStats,
  View,
  validateUserUpdate,
} from '../entity';
import { getAuthorPostStats } from '../entity/posts';
import {
  AuthenticationError,
  ValidationError,
  ForbiddenError,
} from 'apollo-server-errors';
import { IResolvers } from '@graphql-tools/utils';
import { FileUpload } from 'graphql-upload/GraphQLUpload.js';
import { Context } from '../Context';
import { traceResolverObject } from './trace';
import { queryPaginatedByDate } from '../common/datePageGenerator';
import {
  getShortUrl,
  getUserReadingRank,
  isValidHttpUrl,
  TagsReadingStatus,
  uploadAvatar,
  uploadDevCardBackground,
} from '../common';
import { getSearchQuery } from './common';
import { ActiveView } from '../entity/ActiveView';
import graphorm from '../graphorm';
import { GraphQLResolveInfo } from 'graphql';
import { TypeOrmError, NotFoundError } from '../errors';
import { deleteUser } from '../directive/user';
import { randomInt } from 'crypto';
import { In } from 'typeorm';
import { DisallowHandle } from '../entity/DisallowHandle';
import { DayOfWeek } from '../types';
import { UserPersonalizedDigest } from '../entity/UserPersonalizedDigest';
import { getTimezoneOffset } from 'date-fns-tz';

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
  createdAt?: Date;
  username?: string;
  bio?: string;
  twitter?: string;
  github?: string;
  hashnode?: string;
  portfolio?: string;
  reputation?: number;
  notificationEmail?: boolean;
  timezone?: string;
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
  url: string;
}

export interface GQLPersonalizedDigest {
  preferredDay: DayOfWeek;
  preferredHour: number;
  preferredTimezone: string;
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

  type DevCard {
    imageUrl: String!
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
    url: String!
  }

  type PersonalizedDigest {
    preferredDay: Int!
    preferredHour: Int!
    preferredTimezone: String!
  }

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
    personalizedDigest: PersonalizedDigest @auth
  }

  extend type Mutation {
    """
    Update user profile information
    """
    updateUserProfile(data: UpdateUserInput, upload: Upload): User @auth

    """
    Generates or updates the user's Dev Card preferences
    """
    generateDevCard(file: Upload, url: String): DevCard @auth

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
      Preferred timezone relevant to the hour and day.
      """
      timezone: String
    ): PersonalizedDigest @auth

    """
    The mutation to unsubscribe from the personalized digest
    """
    unsubscribePersonalizedDigest: EmptyResponse @auth
  }
`;

export const getUserPermalink = (
  user: Pick<GQLUser, 'id' | 'username'>,
): string => `${process.env.COMMENTS_PREFIX}/${user.username ?? user.id}`;

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
        query: args?.query,
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
      const isSameUser = ctx.userId === id;
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
        numPostViews: isSameUser ? postStats?.numPostViews ?? 0 : null,
        numPostUpvotes: isSameUser ? postStats?.numPostUpvotes ?? 0 : null,
        numCommentUpvotes: isSameUser
          ? commentStats?.numCommentUpvotes ?? 0
          : null,
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
          select distinct(ts_headline(process_text(title), search.query,
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
        [ctx.userId, query],
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

      const campaignUrl = new URL('/join', process.env.COMMENTS_PREFIX);
      campaignUrl.searchParams.append('cid', referralOrigin);
      campaignUrl.searchParams.append('userid', ctx.userId);

      const [referredUsersCount, url] = await Promise.all([
        userRepo.count({
          where: { referralId: ctx.userId, referralOrigin },
        }),
        getShortUrl(campaignUrl.toString(), ctx.log),
      ]);

      return {
        referredUsersCount,
        url,
      };
    },
    personalizedDigest: async (
      _,
      args,
      ctx: Context,
    ): Promise<GQLPersonalizedDigest> => {
      const personalizedDigest = await ctx
        .getRepository(UserPersonalizedDigest)
        .findOneBy({ userId: ctx.userId });

      if (!personalizedDigest) {
        throw new NotFoundError('Not subscribed to personalized digest');
      }

      return personalizedDigest;
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Mutation: traceResolverObject<any, any>({
    generateDevCard: async (
      source,
      { file, url }: { file?: FileUpload; url: string },
      ctx: Context,
    ): Promise<{ imageUrl: string }> => {
      const repo = ctx.con.getRepository(DevCard);
      let devCard: DevCard = await repo.findOneBy({ userId: ctx.userId });
      if (!devCard) {
        devCard = await repo.save({ userId: ctx.userId });
      } else if (!file && !url) {
        await repo.update(devCard.id, { background: null });
      }
      if (file) {
        const { createReadStream } = await file;
        const stream = createReadStream();
        const { url: backgroundImage } = await uploadDevCardBackground(
          devCard.id,
          stream,
        );
        await repo.update(devCard.id, { background: backgroundImage });
      } else if (url) {
        if (!isValidHttpUrl(url)) {
          throw new ValidationError('Invalid url');
        }
        await repo.update(devCard.id, { background: url });
      }
      // Avoid caching issues with the new version
      const randomStr = Math.random().toString(36).substring(2, 5);
      return {
        imageUrl: `${process.env.URL_PREFIX}/devcards/${devCard.id.replace(
          /-/g,
          '',
        )}.png?r=${randomStr}`,
      };
    },
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
        timezone?: string;
      },
      ctx: Context,
    ): Promise<GQLPersonalizedDigest> => {
      const { hour, day, timezone } = args;

      if (!isNullOrUndefined(hour) && (hour < 0 || hour > 23)) {
        throw new ValidationError('Invalid hour');
      }

      if (!isNullOrUndefined(hour) && (day < 0 || day > 6)) {
        throw new ValidationError('Invalid day');
      }

      if (
        !isNullOrUndefined(timezone) &&
        Number.isNaN(getTimezoneOffset(timezone))
      ) {
        throw new ValidationError('Invalid timezone');
      }

      const repo = ctx.con.getRepository(UserPersonalizedDigest);

      const personalizedDigest = await repo.save({
        userId: ctx.userId,
        preferredDay: day,
        preferredHour: hour,
        preferredTimezone: timezone,
      });

      return personalizedDigest;
    },
    unsubscribePersonalizedDigest: async (
      _,
      args,
      ctx: Context,
    ): Promise<unknown> => {
      const repo = ctx.con.getRepository(UserPersonalizedDigest);

      if (ctx.userId) {
        await repo.delete({
          userId: ctx.userId,
        });
      }

      return { _: true };
    },
  }),
  User: {
    permalink: getUserPermalink,
  },
};
