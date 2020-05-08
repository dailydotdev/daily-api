import { gql, IResolvers } from 'apollo-server-fastify';
import { GQLSource } from './sources';
import { Context } from '../Context';
import { traceResolverObject } from './trace';
import { generateFeed, notifyPostReport } from '../common';
import { NotFound, ValidationError } from '../errors';
import { HiddenPost, Post } from '../entity';
import { GQLEmptyResponse } from './common';
import { Connection, DeepPartial } from 'typeorm';

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
  read?: boolean;
  bookmarked?: boolean;
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

    """
    Source of the post
    """
    source: Source!

    """
    Tags of the post
    """
    tags: [String!]

    """
    Whether the user has read this post
    """
    read: Boolean @auth

    """
    Whether the user bookmarked this post
    """
    bookmarked: Boolean @auth
  }

  type PostConnection {
    pageInfo: PageInfo!
    edges: [PostEdge!]!
    """
    The original query in case of a search operation
    """
    query: String
  }

  type PostEdge {
    node: Post!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  """
  Enum of the possible reasons to report a post
  """
  enum ReportReason {
    """
    The post's link is broken
    """
    BROKEN
    """
    The post is not safe for work (NSFW), for any reason
    """
    NSFW
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

  extend type Mutation {
    """
    Hide a post from all the user feeds
    """
    hidePost(
      """
      Id of the post to hide
      """
      id: ID
    ): EmptyResponse @auth

    """
    Report a post and hide it from all the user feeds
    """
    reportPost(
      """
      Id of the post to report
      """
      id: ID
      """
      Reason the user would like to report
      """
      reason: ReportReason
    ): EmptyResponse @auth
  }
`;

const saveHiddenPost = async (
  con: Connection,
  hiddenPost: DeepPartial<HiddenPost>,
): Promise<boolean> => {
  try {
    const repo = con.getRepository(HiddenPost);
    await repo.insert(repo.create(hiddenPost));
  } catch (err) {
    // Foreign key violation
    if (err?.code === '23503') {
      throw new NotFound();
    }
    // Unique violation
    if (err?.code !== '23505') {
      throw err;
    }
    return false;
  }
  return true;
};

const reportReasons = new Map([
  ['BROKEN', 'Link is broken'],
  ['NSFW', 'Post is NSFW'],
]);

const defaultImage = {
  urls: process.env.DEFAULT_IMAGE_URL.split(','),
  ratio: parseFloat(process.env.DEFAULT_IMAGE_RATIO),
  placeholder: process.env.DEFAULT_IMAGE_PLACEHOLDER,
};

const pickImageUrl = (post: GQLPost): string =>
  defaultImage.urls[
    Math.floor(post.createdAt.getTime() / 1000) % defaultImage.urls.length
  ];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = {
  Query: traceResolverObject({
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
  }),
  Mutation: traceResolverObject({
    hidePost: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      await saveHiddenPost(ctx.con, { userId: ctx.userId, postId: id });
      return { _: true };
    },
    reportPost: async (
      source,
      { id, reason }: { id: string; reason: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      if (!reportReasons.has(reason)) {
        throw new ValidationError();
      }
      const added = await saveHiddenPost(ctx.con, {
        userId: ctx.userId,
        postId: id,
      });
      if (added) {
        const post = await ctx.getRepository(Post).findOneOrFail(id);
        await notifyPostReport(ctx.userId, post, reportReasons.get(reason));
      }
      return { _: true };
    },
  }),
  Post: {
    image: (post: GQLPost): string => post.image || pickImageUrl(post),
    placeholder: (post: GQLPost): string =>
      post.image ? post.placeholder : defaultImage.placeholder,
    ratio: (post: GQLPost): number =>
      post.image ? post.ratio : defaultImage.ratio,
  },
};
