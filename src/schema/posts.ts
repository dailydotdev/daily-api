import { gql, IResolvers } from 'apollo-server-fastify';
import { GQLSource } from './sources';
import { Context } from '../Context';
import { traceResolvers } from './trace';
import { generateFeed } from '../common';
import { NotFound } from '../errors';

export interface GQLPost {
  id: string;
  publishedAt?: Date;
  createdAt: Date;
  url: string;
  title: string;
  image?: string;
  ratio?: number;
  placeholder?: string;
  readTime?: number;
  source?: GQLSource;
  tags?: string[];
}

export const typeDefs = gql`
  """
  Blog post
  """
  type Post {
    """
    Unique identifier
    """
    id: ID!

    """
    Time the post was published
    """
    publishedAt: DateTime

    """
    Time the post was added to the database
    """
    createdAt: DateTime!

    """
    URL to the post
    """
    url: String!

    """
    Title of the post
    """
    title: String!

    """
    URL to the image of post
    """
    image: String

    """
    Aspect ratio of the image
    """
    ratio: Float

    """
    Tiny version of the image in base64
    """
    placeholder: String

    """
    Estimation of time to read the article (in minutes)
    """
    readTime: Float

    source: Source

    tags: [String]
  }

  type PostConnection {
    pageInfo: PageInfo!
    edges: [PostEdge!]!
  }

  type PostEdge {
    node: Post!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  extend type Query {
    """
    Get post by id
    """
    post(
      """
      Id of the requested post
      """
      id: ID
    ): Post!
  }
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Query: {
    post: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLPost> => {
      const feed = await generateFeed(ctx, 1, 0, (builder) =>
        builder.where('post.id = :id', { id }),
      );
      if (feed.nodes.length) {
        return feed.nodes[0];
      }
      throw new NotFound();
    },
  },
});
