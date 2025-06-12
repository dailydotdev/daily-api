import { z } from 'zod';
import { ValidationError, ForbiddenError } from 'apollo-server-errors';
import { AuthContext } from '../../Context';
import { Post } from '../../entity';

export interface StartPostBoostArgs {
  postId: string;
  userId: string;
  duration: number;
  budget: number;
}

export const POST_BOOST_VALIDATION_SCHEMA = z.object({
  budget: z
    .number()
    .int()
    .min(1000)
    .max(100000)
    .refine((value) => value % 1000 === 0, {
      message: 'Budget must be divisible by 1000',
    }),
  duration: z
    .number()
    .int()
    .min(1)
    .max(30)
    .refine((value) => value % 1 === 0, {
      message: 'Duration must be a whole number',
    }),
});

export const validatePostBoostArgs = (
  args: Omit<StartPostBoostArgs, 'userId'>,
) => {
  const result = POST_BOOST_VALIDATION_SCHEMA.safeParse(args);

  if (result.error) {
    throw new ValidationError(result.error.errors[0].message);
  }
};

export const validatePostBoostPermissions = async (
  ctx: AuthContext,
  postId: string,
): Promise<Pick<Post, 'id' | 'flags'>> => {
  // TODO: remove this once we are ready for production
  if (!ctx.isTeamMember) {
    throw new ForbiddenError('You must be a team member to boost posts');
  }

  const { userId } = ctx;

  return ctx.con.getRepository(Post).findOneOrFail({
    select: ['id', 'flags'],
    where: [
      { id: postId, authorId: userId },
      { id: postId, scoutId: userId },
    ],
  });
};

export const checkPostAlreadyBoosted = (post: Pick<Post, 'flags'>): void => {
  if (post.flags?.boosted) {
    throw new ValidationError('Post is already boosted');
  }
};
