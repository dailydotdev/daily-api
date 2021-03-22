import { gql, IResolvers, ValidationError } from 'apollo-server-fastify';
import { Connection, DeepPartial } from 'typeorm';
import { GraphQLResolveInfo } from 'graphql';
import { GQLSource } from './sources';
import { Context } from '../Context';
import { traceResolverObject } from './trace';
import {
  defaultImage,
  getDiscussionLink,
  getPostsIndex,
  notifyPostReport,
  notifyPostUpvoted,
  notifyPostUpvoteCanceled,
  pickImageUrl,
} from '../common';
import { HiddenPost, Post, Upvote } from '../entity';
import { GQLEmptyResponse } from './common';
import { NotFoundError } from '../errors';
import { GQLBookmarkList } from './bookmarks';
import { GQLComment } from './comments';
import graphorm from '../graphorm';
import { GQLUser } from './users';
import { redisPubSub } from '../redis';

export interface GQLPost {
  id: string;
  shortId: string;
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
  upvoted?: boolean;
  commented?: boolean;
  bookmarkList?: GQLBookmarkList;
  numUpvotes: number;
  numComments: number;
  featuredComments?: GQLComment[];
  // Used only for pagination (not part of the schema)
  score: number;
  bookmarkedAt: Date;
  author?: GQLUser;
  views?: number;
  discussionScore?: number;
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
    Unique URL friendly short identifier
    """
    shortId: String

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
    read: Boolean

    """
    Whether the user bookmarked this post
    """
    bookmarked: Boolean

    """
    Whether the user upvoted this post
    """
    upvoted: Boolean

    """
    Whether the user commented this post
    """
    commented: Boolean

    """
    If bookmarked, this is the list where it is saved
    """
    bookmarkList: BookmarkList

    """
    Permanent link to the post
    """
    permalink: String!

    """
    Total number of upvotes
    """
    numUpvotes: Int!

    """
    Total number of comments
    """
    numComments: Int!

    """
    Permanent link to the comments of the post
    """
    commentsPermalink: String!

    """
    Featured comments for the post
    """
    featuredComments: [Comment!]

    """
    Author of the post (if they have a daily.dev account)
    """
    author: User

    """
    Number of times the article has been viewed (unique readers)
    """
    views: Int

    """
    Trending score of the post
    """
    trending: Int
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

    """
    Delete a post permanently
    """
    deletePost(
      """
      Id of the post to delete
      """
      id: ID
    ): EmptyResponse @auth(requires: [MODERATOR])

    """
    Upvote to the post
    """
    upvote(
      """
      Id of the post to upvote
      """
      id: ID!
    ): EmptyResponse @auth

    """
    Cancel an upvote of a post
    """
    cancelUpvote(
      """
      Id of the post
      """
      id: ID!
    ): EmptyResponse @auth
  }

  type Subscription {
    """
    Get notified when one of the given posts is upvoted or comments
    """
    postsEngaged(
      """
      IDs of the posts
      """
      ids: [ID]!
    ): Post
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
      throw new NotFoundError('Post not found');
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = {
  Query: traceResolverObject({
    post: async (
      source,
      { id }: { id: string },
      ctx: Context,
      info,
    ): Promise<GQLPost> => {
      const res = await graphorm.query<GQLPost>(ctx, info, (builder) => ({
        queryBuilder: builder.queryBuilder.where(
          `"${builder.alias}"."id" = :id`,
          { id },
        ),
        ...builder,
      }));
      if (res.length) {
        return res[0];
      }
      throw new NotFoundError('Post not found');
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
        throw new ValidationError('Reason is invalid');
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
    deletePost: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      await ctx.getRepository(Post).delete({ id });
      await getPostsIndex().deleteObject(id);
      return { _: true };
    },
    upvote: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      try {
        await ctx.con.transaction(async (entityManager) => {
          await entityManager.getRepository(Upvote).insert({
            postId: id,
            userId: ctx.userId,
          });
          await entityManager
            .getRepository(Post)
            .increment({ id }, 'upvotes', 1);
        });
        notifyPostUpvoted(ctx.log, id, ctx.userId);
      } catch (err) {
        // Foreign key violation
        if (err?.code === '23503') {
          throw new NotFoundError('Post or user not found');
        }
        // Unique violation
        if (err?.code !== '23505') {
          throw err;
        }
      }
      return { _: true };
    },
    cancelUpvote: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      const exists = await ctx.con.transaction(async (entityManager) => {
        const upvote = await entityManager.getRepository(Upvote).findOne({
          postId: id,
          userId: ctx.userId,
        });
        if (upvote) {
          await entityManager.getRepository(Upvote).delete({
            postId: id,
            userId: ctx.userId,
          });
          await entityManager
            .getRepository(Post)
            .decrement({ id }, 'upvotes', 1);
          return true;
        }
        return false;
      });
      if (exists) {
        notifyPostUpvoteCanceled(ctx.log, id, ctx.userId);
      }
      return { _: true };
    },
  }),
  Subscription: {
    postsEngaged: {
      subscribe: async (
        source: unknown,
        { ids }: { ids: string[] },
        ctx: Context,
        info: GraphQLResolveInfo,
      ): Promise<AsyncIterator<{ postsEngaged: GQLPost }>> => {
        const it = {
          [Symbol.asyncIterator]: () =>
            redisPubSub.asyncIterator<{ postId: string }>('events.posts.*', {
              pattern: true,
            }),
        };
        return (async function* () {
          for await (const value of it) {
            if (ids.indexOf(value.postId) < 0) {
              continue;
            }
            const res = await graphorm.query<GQLPost>(ctx, info, (builder) => ({
              queryBuilder: builder.queryBuilder.where(
                `"${builder.alias}"."id" = :id`,
                { id: value.postId },
              ),
              ...builder,
            }));
            yield { postsEngaged: res[0] };
          }
        })();
      },
    },
  },
  Post: {
    image: (post: GQLPost): string => post.image || pickImageUrl(post),
    placeholder: (post: GQLPost): string =>
      post.image ? post.placeholder : defaultImage.placeholder,
    ratio: (post: GQLPost): number =>
      post.image ? post.ratio : defaultImage.ratio,
    permalink: (post: GQLPost): string =>
      `${process.env.URL_PREFIX}/r/${post.shortId}`,
    commentsPermalink: (post: GQLPost): string => getDiscussionLink(post.id),
  },
};
