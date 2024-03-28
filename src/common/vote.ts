import { ValidationError } from 'apollo-server-errors';
import { NotFoundError, TypeOrmError } from '../errors';
import { Post, UserPost } from '../entity';
import { GQLEmptyResponse } from '../schema/common';
import { ensureSourcePermissions } from '../schema/sources';
import { Context } from '../Context';

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

export const votePost = async ({
  ctx,
  id,
  vote,
}: UserVoteProps): Promise<GQLEmptyResponse> => {
  try {
    if (!Object.values(UserVote).includes(vote)) {
      throw new ValidationError('Unsupported vote type');
    }

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
