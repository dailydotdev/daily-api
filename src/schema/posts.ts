import {
  Connection as ConnectionRelay,
  ConnectionArguments,
} from 'graphql-relay';
import { ValidationError } from 'apollo-server-errors';
import { IResolvers } from 'graphql-tools';
import { Connection, DeepPartial } from 'typeorm';
import { GQLSource } from './sources';
import { Context } from '../Context';
import { traceResolverObject } from './trace';
import { defaultImage, getDiscussionLink, pickImageUrl } from '../common';
import { HiddenPost, Post, Toc, Upvote, PostReport } from '../entity';
import { GQLEmptyResponse } from './common';
import { NotFoundError } from '../errors';
import { GQLBookmarkList } from './bookmarks';
import { GQLComment } from './comments';
import graphorm from '../graphorm';
import { GQLUser } from './users';
import { redisPubSub } from '../redis';
import { queryPaginatedByDate } from '../common/datePageGenerator';

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
  description?: string;
  toc?: Toc;
  summary?: string;
}

export type GQLPostNotification = Pick<
  GQLPost,
  'id' | 'numUpvotes' | 'numComments'
>;

export interface GQLPostUpvote {
  createdAt: Date;
  post: GQLPost;
}

export interface GQLPostUpvoteArgs extends ConnectionArguments {
  id: string;
}

export const getPostNotification = async (
  con: Connection,
  postId: string,
): Promise<GQLPostNotification> => {
  const post = await con
    .getRepository(Post)
    .findOne(postId, { select: ['id', 'upvotes', 'comments'] });
  if (!post) {
    return null;
  }
  return { id: post.id, numUpvotes: post.upvotes, numComments: post.comments };
};

export const typeDefs = /* GraphQL */ `
  type TocItem {
    """
    Content of the toc item
    """
    text: String!

    """
    Id attribute of the Html element of the toc item
    """
    id: String

    """
    Children items of the toc item
    """
    children: [TocItem]
  }

  """
  Post notification
  """
  type PostNotification {
    """
    Unique identifier
    """
    id: ID!

    """
    Total number of upvotes
    """
    numUpvotes: Int!

    """
    Total number of comments
    """
    numComments: Int!
  }

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

    """
    Meta description of the post
    """
    description: String

    """
    Table of content of the post
    """
    toc: [TocItem]

    """
    Auto generated summary
    """
    summary: String
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

  type Upvote {
    createdAt: DateTime!

    user: User!
    post: Post!
  }

  type UpvoteEdge {
    node: Upvote!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  type UpvoteConnection {
    pageInfo: PageInfo!
    edges: [UpvoteEdge!]!
    """
    The original query in case of a search operation
    """
    query: String
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
    The post is a clickbait
    """
    CLICKBAIT
    """
    The post has low quality content
    """
    LOW
    """
    The post is not safe for work (NSFW), for any reason
    """
    NSFW
    """
    Reason doesnt fit any specific category
    """
    OTHER
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

    """
    Get post by URL
    """
    postByUrl(
      """
      URL of the requested post
      """
      url: String
    ): Post!

    """
    Get Post's Upvotes by post id
    """
    postUpvotes(
      """
      Id of the relevant post to return Upvotes
      """
      id: String!

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int
    ): UpvoteConnection!
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
      """
      Additional comment about report reason
      """
      comment: String
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
    Bans a post (can be undone)
    """
    banPost(
      """
      Id of the post to ban
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
    postsEngaged: PostNotification
  }
`;

const saveHiddenPost = async (
  con: Connection,
  hiddenPost: DeepPartial<HiddenPost>,
): Promise<boolean> => {
  try {
    await con.getRepository(HiddenPost).insert(hiddenPost);
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

export const reportReasons = new Map([
  ['BROKEN', '💔 Link is broken'],
  ['NSFW', '🔞 Post is NSFW'],
  ['CLICKBAIT', '🎣 Clickbait!!!'],
  ['LOW', '💩 Low quality content'],
  ['OTHER', '🤔 Other'],
]);

export const getPostPermalink = (post: Pick<GQLPost, 'shortId'>): string =>
  `${process.env.URL_PREFIX}/r/${post.shortId}`;

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
          `"${builder.alias}"."id" = :id AND "${builder.alias}"."deleted" = false`,
          { id },
        ),
        ...builder,
      }));
      if (res.length) {
        return res[0];
      }
      throw new NotFoundError('Post not found');
    },
    postByUrl: async (
      source,
      { url }: { id: string; url: string },
      ctx: Context,
      info,
    ) => {
      const res = await graphorm.query(ctx, info, (builder) => ({
        queryBuilder: builder.queryBuilder
          .where(
            `("${builder.alias}"."canonicalUrl" = :url OR "${builder.alias}"."url" = :url) AND "${builder.alias}"."deleted" = false`,
            { url },
          )
          .limit(1),
        ...builder,
      }));
      if (res.length) {
        return res[0];
      }
      throw new NotFoundError('Post not found');
    },
    postUpvotes: async (
      _,
      args: GQLPostUpvoteArgs,
      ctx,
      info,
    ): Promise<ConnectionRelay<GQLPostUpvote>> => {
      return queryPaginatedByDate(
        ctx,
        info,
        args,
        { key: 'createdAt' },
        {
          queryBuilder: (builder) => {
            builder.queryBuilder = builder.queryBuilder.andWhere(
              `${builder.alias}.postId = :postId`,
              { postId: args.id },
            );

            return builder;
          },
          orderByKey: 'DESC',
        },
      );
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
      { id, reason, comment }: { id: string; reason: string; comment: string },
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
        if (!post.banned) {
          try {
            await ctx.getRepository(PostReport).insert({
              postId: id,
              userId: ctx.userId,
              reason,
              comment,
            });
          } catch (err) {
            if (err?.code !== '23505') {
              ctx.log.error(
                {
                  err,
                },
                'failed to save report to database',
              );
            }
          }
        }
      }
      return { _: true };
    },
    deletePost: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      await ctx.getRepository(Post).update({ id }, { deleted: true });
      return { _: true };
    },
    banPost: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      const post = await ctx.getRepository(Post).findOneOrFail(id);
      if (!post.banned) {
        await ctx.getRepository(Post).update({ id }, { banned: true });
      }
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
      await ctx.con.transaction(async (entityManager) => {
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
      return { _: true };
    },
  }),
  Subscription: {
    postsEngaged: {
      subscribe: async (): Promise<
        AsyncIterator<{ postsEngaged: GQLPostNotification }>
      > => {
        const it = {
          [Symbol.asyncIterator]: () =>
            redisPubSub.asyncIterator<GQLPostNotification>('events.posts.*', {
              pattern: true,
            }),
        };
        return (async function* () {
          for await (const value of it) {
            // const res = await graphorm.query<GQLPost>(ctx, info, (builder) => ({
            //   queryBuilder: builder.queryBuilder.where(
            //     `"${builder.alias}"."id" = :id`,
            //     { id: value.postId },
            //   ),
            //   ...builder,
            // }));
            yield { postsEngaged: value };
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
    permalink: getPostPermalink,
    commentsPermalink: (post: GQLPost): string => getDiscussionLink(post.id),
  },
};
