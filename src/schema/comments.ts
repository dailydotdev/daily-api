import { GraphQLResolveInfo } from 'graphql';
import shortid from 'shortid';
import { ForbiddenError, gql, IResolvers } from 'apollo-server-fastify';
import { Context } from '../Context';
import { traceResolverObject } from './trace';
import { getDiscussionLink } from '../common';
import { Comment, CommentUpvote, Post } from '../entity';
import { NotFoundError } from '../errors';
import { GQLEmptyResponse } from './common';
import { GQLUser } from './users';
import { Connection, ConnectionArguments } from 'graphql-relay';
import graphorm from '../graphorm';
import { GQLPost } from './posts';
import { Roles } from '../roles';
import { queryPaginatedByDate } from '../common/datePageGenerator';

export interface GQLComment {
  id: string;
  postId: string;
  content: string;
  contentHtml: string;
  createdAt: Date;
  author?: GQLUser;
  upvoted?: boolean;
  children?: Connection<GQLComment>;
  post: GQLPost;
  numUpvotes: number;
}

interface GQLPostCommentArgs {
  postId: string;
  content: string;
}

interface GQLCommentCommentArgs {
  commentId: string;
  content: string;
}

export interface GQLCommentUpvote {
  createdAt: Date;
  comment: GQLComment;
}

export const typeDefs = gql`
  type Comment {
    """
    Unique identifier
    """
    id: ID!

    """
    Content of the comment
    """
    content: String!

    """
    HTML Parsed content of the comment
    """
    contentHtml: String!

    """
    Time when comment was created
    """
    createdAt: DateTime!

    """
    Time when comment was last updated (edited)
    """
    lastUpdatedAt: DateTime

    """
    Permanent link to the comment
    """
    permalink: String!

    """
    Author of this comment
    """
    author: User!

    """
    Whether the user upvoted this comment
    """
    upvoted: Boolean

    """
    Sub comments of this comment
    """
    children: CommentConnection

    """
    The post that was commented
    """
    post: Post!

    """
    Total number of upvotes
    """
    numUpvotes: Int!
  }

  type CommentEdge {
    node: Comment!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  type CommentConnection {
    pageInfo: PageInfo!
    edges: [CommentEdge!]!
  }

  type CommentUpvote {
    createdAt: DateTime!

    user: User!
    comment: Comment!
  }

  type CommentUpvoteEdge {
    node: CommentUpvote!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  type CommentUpvoteConnection {
    pageInfo: PageInfo!
    edges: [CommentUpvoteEdge!]!
  }

  extend type Query {
    """
    Get the comments of a post
    """
    postComments(
      """
      Post id
      """
      postId: ID!

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int
    ): CommentConnection!

    """
    Get Comment's Upvotes by post id
    """
    commentUpvotes(
      """
      Id of the relevant comment to return Upvotes
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
    ): CommentUpvoteConnection!

    """
    Get the comments of a user
    """
    userComments(
      """
      User id (author)
      """
      userId: ID!

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int
    ): CommentConnection!
  }

  extend type Mutation {
    """
    Comment on a post
    """
    commentOnPost(
      """
      Id of the post
      """
      postId: ID!
      """
      Content of the comment
      """
      content: String!
    ): Comment @auth

    """
    Comment on a comment
    """
    commentOnComment(
      """
      Id of the comment
      """
      commentId: ID!
      """
      Content of the comment
      """
      content: String!
    ): Comment @auth

    """
    Edit comment
    """
    editComment(
      """
      Id of the comment to edit
      """
      id: ID!
      """
      New content of the comment
      """
      content: String!
    ): Comment @auth

    """
    Delete a comment
    """
    deleteComment(
      """
      Id of the comment
      """
      id: ID!
    ): EmptyResponse @auth

    """
    Upvote to a comment
    """
    upvoteComment(
      """
      Id of the comment to upvote
      """
      id: ID!
    ): EmptyResponse @auth

    """
    Cancel an upvote of a comment
    """
    cancelCommentUpvote(
      """
      Id of the comment
      """
      id: ID!
    ): EmptyResponse @auth
  }
`;

export interface GQLPostCommentsArgs extends ConnectionArguments {
  postId: string;
}

export interface GQLCommentUpvoteArgs extends ConnectionArguments {
  id: string;
}

export interface GQLUserCommentsArgs extends ConnectionArguments {
  userId: string;
}

const getCommentById = async (
  id: string,
  ctx: Context,
  info: GraphQLResolveInfo,
): Promise<GQLComment> => {
  const res = await graphorm.query<GQLComment>(ctx, info, (builder) => {
    builder.queryBuilder = builder.queryBuilder
      .andWhere(`${builder.alias}.id = :id`, { id })
      .limit(1);
    return builder;
  });
  return res[0];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Query: traceResolverObject<any, any>({
    postComments: async (
      _,
      args: GQLPostCommentsArgs,
      ctx,
      info,
    ): Promise<Connection<GQLComment>> => {
      return queryPaginatedByDate(
        ctx,
        info,
        args,
        { key: 'createdAt' },
        {
          queryBuilder: (builder) => {
            builder.queryBuilder = builder.queryBuilder
              .andWhere(`${builder.alias}.postId = :postId`, {
                postId: args.postId,
              })
              .andWhere(`${builder.alias}.parentId is null`);

            return builder;
          },
        },
      );
    },
    userComments: async (
      _,
      args: GQLUserCommentsArgs,
      ctx,
      info,
    ): Promise<Connection<GQLComment>> => {
      return queryPaginatedByDate(
        ctx,
        info,
        args,
        { key: 'createdAt' },
        {
          queryBuilder: (builder) => {
            builder.queryBuilder = builder.queryBuilder.andWhere(
              `${builder.alias}."userId" = :userId`,
              { userId: args.userId },
            );

            return builder;
          },
          orderByKey: 'DESC',
        },
      );
    },
    commentUpvotes: async (
      _,
      args: GQLCommentUpvoteArgs,
      ctx,
      info,
    ): Promise<Connection<GQLCommentUpvote>> => {
      return queryPaginatedByDate(
        ctx,
        info,
        args,
        { key: 'createdAt' },
        {
          queryBuilder: (builder) => {
            builder.queryBuilder = builder.queryBuilder.andWhere(
              `${builder.alias}.commentId = :commentId`,
              { commentId: args.id },
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
    commentOnPost: async (
      source,
      { postId, content }: GQLPostCommentArgs,
      ctx: Context,
      info,
    ): Promise<GQLComment> => {
      try {
        const comment = await ctx.con.transaction(async (entityManager) => {
          const comment = await entityManager.getRepository(Comment).save(
            entityManager.getRepository(Comment).create({
              id: shortid.generate(),
              postId,
              userId: ctx.userId,
              content,
            }),
          );
          await entityManager
            .getRepository(Post)
            .increment({ id: postId }, 'comments', 1);
          return comment;
        });
        return getCommentById(comment.id, ctx, info);
      } catch (err) {
        // Foreign key violation
        if (err?.code === '23503') {
          throw new NotFoundError('Post or user not found');
        }
        throw err;
      }
    },
    commentOnComment: async (
      source,
      { commentId, content }: GQLCommentCommentArgs,
      ctx: Context,
      info,
    ): Promise<GQLComment> => {
      try {
        const comment = await ctx.con.transaction(async (entityManager) => {
          const parentComment = await entityManager
            .getRepository(Comment)
            .findOneOrFail({ id: commentId });
          if (parentComment.parentId) {
            throw new ForbiddenError('Cannot comment on a sub-comment');
          }
          const comment = await entityManager.getRepository(Comment).save(
            entityManager.getRepository(Comment).create({
              id: shortid.generate(),
              postId: parentComment.postId,
              userId: ctx.userId,
              parentId: commentId,
              content,
            }),
          );
          await entityManager
            .getRepository(Post)
            .increment({ id: parentComment.postId }, 'comments', 1);
          await entityManager
            .getRepository(Comment)
            .increment({ id: commentId }, 'comments', 1);
          return comment;
        });
        return getCommentById(comment.id, ctx, info);
      } catch (err) {
        // Foreign key violation
        if (err?.code === '23503') {
          throw new NotFoundError('User or parent comment not found');
        }
        throw err;
      }
    },
    editComment: async (
      source,
      { id, content }: { id: string; content: string },
      ctx: Context,
      info,
    ): Promise<GQLComment> => {
      await ctx.con.transaction(async (entityManager) => {
        const repo = entityManager.getRepository(Comment);
        const comment = await repo.findOneOrFail({ id });
        if (comment.userId !== ctx.userId) {
          throw new ForbiddenError("Cannot edit someone else's comment");
        }
        comment.content = content;
        comment.lastUpdatedAt = new Date();
        await repo.save(comment);
      });
      return getCommentById(id, ctx, info);
    },
    deleteComment: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con.transaction(async (entityManager) => {
        const repo = entityManager.getRepository(Comment);
        const comment = await repo.findOneOrFail({ id });
        if (
          comment.userId !== ctx.userId &&
          ctx.roles.indexOf(Roles.Moderator) < 0
        ) {
          throw new ForbiddenError("Cannot delete someone else's comment");
        }
        if (comment.parentId) {
          await repo.decrement({ id: comment.parentId }, 'comments', 1);
        }
        const childComments = await entityManager
          .getRepository(Comment)
          .count({ parentId: comment.id });
        await entityManager
          .getRepository(Post)
          .decrement({ id: comment.postId }, 'comments', 1 + childComments);
        await repo.delete({ id: comment.id });
      });
      return { _: true };
    },
    upvoteComment: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      try {
        await ctx.con.transaction(async (entityManager) => {
          await entityManager.getRepository(CommentUpvote).insert({
            commentId: id,
            userId: ctx.userId,
          });
          await entityManager
            .getRepository(Comment)
            .increment({ id }, 'upvotes', 1);
        });
      } catch (err) {
        // Foreign key violation
        if (err?.code === '23503') {
          throw new NotFoundError('Comment or user not found');
        }
        // Unique violation
        if (err?.code !== '23505') {
          throw err;
        }
      }
      return { _: true };
    },
    cancelCommentUpvote: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con.transaction(async (entityManager): Promise<boolean> => {
        const upvote = await entityManager
          .getRepository(CommentUpvote)
          .findOne({
            commentId: id,
            userId: ctx.userId,
          });
        if (upvote) {
          await entityManager.getRepository(CommentUpvote).delete({
            commentId: id,
            userId: ctx.userId,
          });
          await entityManager
            .getRepository(Comment)
            .decrement({ id }, 'upvotes', 1);
          return true;
        }
        return false;
      });
      return { _: true };
    },
  }),
  Comment: {
    permalink: (comment: GQLComment): string =>
      getDiscussionLink(comment.postId),
  },
};
