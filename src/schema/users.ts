import { gql, IResolvers } from 'apollo-server-fastify';
import { Context } from '../Context';
import { traceResolverObject } from './trace';
import { Comment, getAuthorPostStats, PostStats, View } from '../entity';

export interface GQLUser {
  id: string;
  name: string;
  image: string;
  username?: string;
}

type CommentStats = { numComments: number; numCommentUpvotes: number };

export type GQLUserStats = PostStats & CommentStats;

export interface GQLReadingRank {
  rankThisWeek?: number;
  rankLastWeek?: number;
  currentRank: number;
  progressThisWeek?: number;
  readToday?: boolean;
}

export interface GQLReadingRankHistory {
  rank: number;
  count: number;
}

export const typeDefs = gql`
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
  }

  type ReadingRankHistory {
    rank: Int!
    count: Int!
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
    Get the reading rank history of the user.
    An aggregated count of all the ranks the user ever received.
    """
    userReadingRankHistory(id: ID!): [ReadingRankHistory]
  }
`;

interface ReadingRankQueryResult {
  thisWeek: number;
  lastWeek: number;
  today: number;
}

const STEPS_PER_RANK = [3, 4, 5, 6, 7];
const STEPS_PER_RANK_REVERSE = STEPS_PER_RANK.reverse();

const rankFromProgress = (progress: number) => {
  const reverseRank = STEPS_PER_RANK_REVERSE.findIndex(
    (threshold) => progress >= threshold,
  );
  if (reverseRank > -1) {
    return STEPS_PER_RANK.length - reverseRank;
  }
  return 0;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = {
  Query: traceResolverObject({
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
      const now = `timezone('utc', now())`;
      const res = await ctx.con
        .createQueryBuilder()
        .select(
          `count(distinct date_trunc('day', "timestamp")) filter(where "timestamp" >= date_trunc('week', ${now}))`,
          'thisWeek',
        )
        .addSelect(
          `count(distinct date_trunc('day', "timestamp")) filter(where "timestamp" < date_trunc('week', ${now}) and "timestamp" >= date_trunc('week', ${now} - interval '7 days'))`,
          'lastWeek',
        )
        .addSelect(
          `count(*) filter(where "timestamp" >= date_trunc('day', ${now}))`,
          'today',
        )
        .from(View, 'view')
        .where('"userId" = :id', { id })
        .getRawOne<ReadingRankQueryResult>();
      const rankThisWeek = rankFromProgress(res.thisWeek);
      const rankLastWeek = rankFromProgress(res.lastWeek);
      return {
        currentRank: rankThisWeek > rankLastWeek ? rankThisWeek : rankLastWeek,
        progressThisWeek: isSameUser ? res.thisWeek : null,
        rankLastWeek: isSameUser ? rankLastWeek : null,
        rankThisWeek: isSameUser ? rankThisWeek : null,
        readToday: isSameUser ? res.today > 0 : null,
      };
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
                      select date_trunc('day', "timestamp") as "timestamp"
                      from "view"
                      where "userId" = $1
                        and "timestamp" >= '2020-12-14'
                        and "timestamp" < date_trunc('week', timezone('utc', now()))
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
  }),
  User: {
    permalink: (user: GQLUser): string =>
      `${process.env.COMMENTS_PREFIX}/${user.username ?? user.id}`,
  },
};
