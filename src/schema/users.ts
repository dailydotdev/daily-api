import { getMostReadTags } from './../common/devcard';
import { GraphORMBuilder } from '../graphorm/graphorm';
import { Connection, ConnectionArguments } from 'graphql-relay';
import {
  Post,
  DevCard,
  User,
  Comment,
  getAuthorPostStats,
  PostStats,
  View,
} from '../entity';
import { ValidationError } from 'apollo-server-errors';
import { IResolvers } from 'graphql-tools';
import { FileUpload } from 'graphql-upload';
import { Context } from '../Context';
import { traceResolverObject } from './trace';
import { queryPaginatedByDate } from '../common/datePageGenerator';
import {
  getUserReadingRank,
  isValidHttpUrl,
  uploadDevCardBackground,
} from '../common';

export interface GQLUser {
  id: string;
  name: string;
  image: string;
  username?: string;
  bio?: string;
  twitter?: string;
  github?: string;
  hashnode?: string;
}

export interface GQLView {
  post: Post;
  timestamp: Date;
}

type CommentStats = { numComments: number; numCommentUpvotes: number };

export type GQLUserStats = PostStats & CommentStats;

export interface GQLReadingRank {
  rankThisWeek?: number;
  rankLastWeek?: number;
  currentRank: number;
  progressThisWeek?: number;
  readToday?: boolean;
  lastReadTime?: Date;
}

export interface GQLReadingRankHistory {
  rank: number;
  count: number;
}

export interface GQLMostReadTag {
  value: string;
  count: number;
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
    name: String!
    """
    Profile image of the user
    """
    image: String!
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
  }

  type MostReadTag {
    value: String!
    count: Int!
  }

  type ReadingRankHistory {
    rank: Int!
    count: Int!
  }

  type ReadHistory {
    date: String!
    reads: Int!
  }

  type DevCard {
    imageUrl: String!
  }

  type ReadingHistory {
    timestamp: DateTime!
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

  extend type Query {
    """
    Get the statistics of the user
    """
    userStats(id: ID!): UserStats
    """
    Get the reading rank of the user
    """
    userReadingRank(id: ID!): ReadingRank
    """
    Get the reading rank of the user
    """
    userMostReadTags(id: ID!): [MostReadTag]
    """
    Get the reading rank history of the user.
    An aggregated count of all the ranks the user ever received.
    """
    userReadingRankHistory(id: ID!): [ReadingRankHistory]
    """
    Get a heatmap of reads per day in a given time frame.
    """
    userReadHistory(id: ID!, after: String!, before: String!): [ReadHistory]
    """
    Get the number of articles the user read
    """
    userReads: Int @auth
    """
    Get user's reading history
    """
    readHistory(
      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int
    ): ReadingHistoryConnection! @auth
  }

  extend type Mutation {
    """
    Generates or updates the user's Dev Card preferences
    """
    generateDevCard(file: Upload, url: String): DevCard @auth

    """
    Hide user's read history
    """
    hideReadHistory(postId: String!, timestamp: DateTime!): EmptyResponse @auth
  }
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Query: traceResolverObject<any, any>({
    userStats: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLUserStats | null> => {
      const isSameUser = ctx.userId === id;
      const [postStats, commentStats] = await Promise.all([
        getAuthorPostStats(ctx.con, id),
        ctx.con
          .createQueryBuilder()
          .select('count(*)', 'numComments')
          .addSelect('sum(comment.upvotes)', 'numCommentUpvotes')
          .from(Comment, 'comment')
          .where({ userId: id })
          .getRawOne<CommentStats>(),
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
    userReadingRank: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLReadingRank> => {
      const isSameUser = ctx.userId === id;
      const user = await ctx.con.getRepository(User).findOneOrFail(id);
      const rank = await getUserReadingRank(ctx.con, id, user?.timezone);
      if (isSameUser) {
        return rank;
      } else {
        return {
          currentRank: rank.currentRank,
        };
      }
    },
    userMostReadTags: async (
      _,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLMostReadTag[]> => {
      const user = await ctx.con.getRepository(User).findOneOrFail(id);

      return getMostReadTags(ctx.con, user.id, { limit: 5 });
    },
    userReadingRankHistory: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLReadingRankHistory[]> => {
      return ctx.con.query(
        `
        select case when days < 3 then 0 else days - 2 end as "rank",
               count(*)                                    as "count"
        from (
               select date_trunc('week', "timestamp") as "timestamp",
                      count(*)                        as days
               from (
                      select date_trunc('day', "timestamp" at time zone COALESCE("user".timezone, 'utc')) as "timestamp"
                      from "view"
                      join "user" on "user".id = view."userId"
                      where "userId" = $1
                        and "timestamp" >= '2020-12-14'
                      group by 1
                      having count(*) > 0
                    ) as days
               group by 1
             ) as weeks
        group by 1;
      `,
        [id],
      );
    },
    userReadHistory: async (
      source,
      { id, after, before }: { id: string; after: string; before: string },
      ctx: Context,
    ): Promise<GQLReadingRankHistory[]> => {
      return ctx.con.query(
        `
          select date_trunc('day', "timestamp" at time zone COALESCE("user".timezone, 'utc'))::date::text as "date", count(*) as "reads"
          from "view"
          join "user" on "user".id = view."userId"
          where "userId" = $1
            and "timestamp" >= $2
            and "timestamp" < $3
          group by 1
          order by 1;
      `,
        [id, after, before],
      );
    },
    userReads: async (source, args, ctx: Context): Promise<number> => {
      return ctx.con
        .getRepository(View)
        .count({ where: { userId: ctx.userId } });
    },
    readHistory: async (
      _,
      args: ConnectionArguments,
      ctx: Context,
      info,
    ): Promise<Connection<GQLView>> => {
      const user = await ctx.con.getRepository(User).findOneOrFail(ctx.userId);
      const queryBuilder = (builder: GraphORMBuilder): GraphORMBuilder => {
        builder.queryBuilder = builder.queryBuilder
          .andWhere(`"${builder.alias}"."userId" = :userId`, {
            userId: ctx.userId,
          })
          .andWhere(`"${builder.alias}"."hidden" = false`)
          .addSelect(
            `"timestamp" at time zone '${user.timezone ?? 'utc'}'`,
            'timestamp',
          );
        return builder;
      };

      return queryPaginatedByDate(
        ctx,
        info,
        args,
        { key: 'timestamp' },
        { queryBuilder, orderByKey: 'DESC' },
      );
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
      let devCard: DevCard = await repo.findOne({ userId: ctx.userId });
      if (!devCard) {
        devCard = await repo.save({ userId: ctx.userId });
      } else if (!file && !url) {
        await repo.update(devCard.id, { background: null });
      }
      if (file) {
        const { createReadStream } = await file;
        const stream = createReadStream();
        const backgroundImage = await uploadDevCardBackground(
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
  }),
  User: {
    permalink: (user: GQLUser): string =>
      `${process.env.COMMENTS_PREFIX}/${user.username ?? user.id}`,
  },
};
