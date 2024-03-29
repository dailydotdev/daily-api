import { ValidationError } from 'apollo-server-errors';
import { NotFoundError, TypeOrmError } from '../errors';
import { Comment, CommentUpvote, Post, UserPost } from '../entity';
import { GQLEmptyResponse } from '../schema/common';
import { ensureSourcePermissions } from '../schema/sources';
import { Context } from '../Context';
import { UserComment } from '../entity/user/UserComment';

export enum UserVote {
  Up = 1,
  None = 0,
  Down = -1,
}

export enum UserVoteEntity {
  Comment = 'comment',
  Post = 'post',
}

export type UserVoteProps = {
  ctx: Context;
  id: string;
  vote: UserVote;
};

const validateVoteType = ({
  vote,
}: Pick<UserVoteProps, 'vote'>): void | never => {
  if (!Object.values(UserVote).includes(vote)) {
    throw new ValidationError('Unsupported vote type');
  }
};

export const votePost = async ({
  ctx,
  id,
  vote,
}: UserVoteProps): Promise<GQLEmptyResponse> => {
  try {
    validateVoteType({ vote });

    const post = await ctx.con.getRepository(Post).findOneByOrFail({ id });
    await ensureSourcePermissions(ctx, post.sourceId);
    const userPostRepo = ctx.con.getRepository(UserPost);

    switch (vote) {
      case UserVote.Up:
        await userPostRepo.save({
          postId: id,
          userId: ctx.userId,
          vote: UserVote.Up,
          hidden: false,
        });

        break;
      case UserVote.Down:
        await userPostRepo.save({
          postId: id,
          userId: ctx.userId,
          vote: UserVote.Down,
          hidden: true,
        });

        break;
      case UserVote.None:
        await userPostRepo.save({
          postId: id,
          userId: ctx.userId,
          vote: UserVote.None,
          hidden: false,
        });

        break;
      default:
        throw new ValidationError('Unsupported vote type');
    }
  } catch (err) {
    // Foreign key violation
    if (err?.code === TypeOrmError.FOREIGN_KEY) {
      throw new NotFoundError('Post or user not found');
    }

    throw err;
  }

  return { _: true };
};

export const voteComment = async ({
  ctx,
  id,
  vote,
}: UserVoteProps): Promise<GQLEmptyResponse> => {
  try {
    validateVoteType({ vote });

    const comment = await ctx.con
      .getRepository<Pick<Comment, 'id' | 'post'>>(Comment)
      .findOneOrFail({
        select: {
          id: true,
          post: {
            sourceId: true,
          },
        },
        relations: {
          post: true,
        },
        where: {
          id,
        },
      });
    const post: Pick<Post, 'sourceId'> = await comment?.post;
    await ensureSourcePermissions(ctx, post.sourceId);

    await ctx.con.transaction(async (entityManager) => {
      const userCommentRepo = entityManager.getRepository(UserComment);
      const commentUpvoteRepo = entityManager.getRepository(CommentUpvote);

      switch (vote) {
        case UserVote.Up:
          await userCommentRepo.save({
            commentId: id,
            userId: ctx.userId,
            vote: UserVote.Up,
          });

          // TODO AS-211 remove this when API reads votes from user_comment
          await commentUpvoteRepo.save({
            commentId: id,
            userId: ctx.userId,
          });
          // TODO AS-211 remove this when API reads votes from user_comment

          break;
        case UserVote.Down:
          await userCommentRepo.save({
            commentId: id,
            userId: ctx.userId,
            vote: UserVote.Down,
          });

          break;
        case UserVote.None:
          await userCommentRepo.save({
            commentId: id,
            userId: ctx.userId,
            vote: UserVote.None,
          });

          // TODO AS-211 remove this when API reads votes from user_comment
          commentUpvoteRepo.delete({
            commentId: id,
            userId: ctx.userId,
          });
          // TODO AS-211 remove this when API reads votes from user_comment

          break;
        default:
          throw new ValidationError('Unsupported vote type');
      }
    });
  } catch (err) {
    // Foreign key violation
    if (err?.code === TypeOrmError.FOREIGN_KEY) {
      throw new NotFoundError('Comment or user not found');
    }

    throw err;
  }

  return { _: true };
};
