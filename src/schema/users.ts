import { gql, IResolvers } from 'apollo-server-fastify';
import { Context } from '../Context';
import { traceResolverObject } from './trace';
import { Comment, getAuthorPostStats, PostStats } from '../entity';

export interface GQLUser {
  id: string;
  name: string;
  image: string;
  username?: string;
}

type CommentStats = { numComments: number; numCommentUpvotes: number };

export type GQLUserStats = PostStats & CommentStats;

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
    numPostViews: Int!
    numPostUpvotes: Int!
    numCommentUpvotes: Int!
  }

  extend type Query {
    """
    Get the statistics of the user
    """
    userStats(id: ID!): UserStats
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
      if (ctx.userId != id) {
        return null;
      }
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
        numPostViews: postStats?.numPostViews ?? 0,
        numPostUpvotes: postStats?.numPostUpvotes ?? 0,
        numCommentUpvotes: commentStats?.numCommentUpvotes ?? 0,
      };
    },
  }),
  User: {
    permalink: (user: GQLUser): string =>
      `${process.env.COMMENTS_PREFIX}/${user.username ?? user.id}`,
  },
};
