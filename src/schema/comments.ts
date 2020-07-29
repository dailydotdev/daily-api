import shortid from 'shortid';
import { gql, IResolvers, ForbiddenError } from 'apollo-server-fastify';
import { Context } from '../Context';
import { traceResolverObject } from './trace';
import {
  notifyCommentCommented,
  notifyCommentUpvoted,
  notifyPostCommented,
} from '../common';
import { Post, Comment, CommentUpvote } from '../entity';
import { NotFoundError } from '../errors';
import { GQLEmptyResponse } from './common';
import { GQLUser } from './users';

export interface GQLComment {
  id: string;
  postId: string;
  content: string;
  createdAt: Date;
  author?: GQLUser;
}

interface GQLPostCommentArgs {
  postId: string;
  content: string;
}

interface GQLCommentCommentArgs {
  commentId: string;
  content: string;
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
    Time when comment was created
    """
    createdAt: DateTime!

    """
    Permanent link to the comment
    """
    permalink: String!

    """
    Author of this comment
    """
    author: User!
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Mutation: traceResolverObject<any, any>({
    commentOnPost: async (
      source,
      { postId, content }: GQLPostCommentArgs,
      ctx: Context,
    ): Promise<GQLComment> => {
      try {
        const comment = await ctx.con.transaction(async (entityManager) => {
          const comment = await entityManager.getRepository(Comment).save({
            id: shortid.generate(),
            postId,
            userId: ctx.userId,
            content,
          });
          await entityManager
            .getRepository(Post)
            .increment({ id: postId }, 'comments', 1);
          return comment;
        });
        await notifyPostCommented(ctx.log, postId, ctx.userId, comment.id);
        return comment;
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
    ): Promise<GQLComment> => {
      try {
        const comment = await ctx.con.transaction(async (entityManager) => {
          const parentComment = await entityManager
            .getRepository(Comment)
            .findOneOrFail({ id: commentId });
          if (parentComment.parentId) {
            throw new ForbiddenError('Cannot comment on a sub-comment');
          }
          const comment = await entityManager.getRepository(Comment).save({
            id: shortid.generate(),
            postId: parentComment.postId,
            userId: ctx.userId,
            parentId: commentId,
            content,
          });
          await entityManager
            .getRepository(Post)
            .increment({ id: parentComment.postId }, 'comments', 1);
          await entityManager
            .getRepository(Comment)
            .increment({ id: commentId }, 'comments', 1);
          return comment;
        });
        await notifyCommentCommented(
          ctx.log,
          comment.postId,
          ctx.userId,
          comment.parentId,
          comment.id,
        );
        return comment;
      } catch (err) {
        // Foreign key violation
        if (err?.code === '23503') {
          throw new NotFoundError('User or parent comment not found');
        }
        throw err;
      }
    },
    deleteComment: async (
      source,
      { id }: { id: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con.transaction(async (entityManager) => {
        const repo = entityManager.getRepository(Comment);
        const comment = await repo.findOneOrFail({ id });
        if (comment.userId !== ctx.userId) {
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
        await notifyCommentUpvoted(ctx.log, id, ctx.userId);
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
      await ctx.con.transaction(async (entityManager) => {
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
        }
      });
      return { _: true };
    },
  }),
  Comment: {
    permalink: (comment: GQLComment): string =>
      `${process.env.COMMENTS_PREFIX}/posts/${comment.postId}`,
  },
};
