import { gql, IResolvers, ValidationError } from 'apollo-server-fastify';
import { FileUpload } from 'graphql-upload';
import { Context } from '../Context';
import { traceResolverObject } from './trace';
import { Comment, getAuthorPostStats, PostStats, View } from '../entity';
import { DevCard } from '../entity/DevCard';
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
    """
    Get a heatmap of reads per day in a given time frame.
    """
    userReadHistory(id: ID!, after: String!, before: String!): [ReadHistory]
    """
    Get the number of articles the user read
    """
    userReads: Int @auth
  }

  extend type Mutation {
    """
    Generates or updates the user's Dev Card preferences
    """
    generateDevCard(file: Upload, url: String): DevCard @auth
  }
`;

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
      const rank = await getUserReadingRank(ctx.con, id);
      if (isSameUser) {
        return rank;
      } else {
        return {
          currentRank: rank.currentRank,
        };
      }
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
    userReadHistory: async (
      source,
      { id, after, before }: { id: string; after: string; before: string },
      ctx: Context,
    ): Promise<GQLReadingRankHistory[]> => {
      return ctx.con.query(
        `
          select date_trunc('day', "timestamp")::date::text as "date", count(*) as "reads"
          from "view"
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
  }),
  Mutation: traceResolverObject({
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
  }),
  User: {
    permalink: (user: GQLUser): string =>
      `${process.env.COMMENTS_PREFIX}/${user.username ?? user.id}`,
  },
};
