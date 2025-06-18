import { z } from 'zod';
import { ValidationError, ForbiddenError } from 'apollo-server-errors';
import { AuthContext, type Context } from '../../Context';
import { Post } from '../../entity';
import graphorm from '../../graphorm';
import type { GQLPost } from '../../schema/posts';
import type { GraphQLResolveInfo } from 'graphql';
import type { PromotedPost, PromotedPostList } from '../../integrations/skadi';
import type { Connection } from 'graphql-relay';

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

export interface GQLBoostedPost {
  campaign: PromotedPost;
  post: GQLPost;
}

export type BoostedPostConnection = Connection<GQLBoostedPost> &
  Omit<PromotedPostList, 'promotedPosts'>;

export const consolidateCampaignsWithPosts = async (
  campaigns: PromotedPost[],
  ctx: Context,
  info: GraphQLResolveInfo,
) => {
  const ids = campaigns.map(({ postId }) => postId);
  const posts = await graphorm.query<GQLPost>(ctx, info, (builder) => ({
    ...builder,
    queryBuilder: builder.queryBuilder.where(
      `${builder.alias}".id IN (...:ids)`,
      { ids },
    ),
  }));
  const mapped = posts.reduce(
    (map, post) => ({ ...map, [post.id]: post }),
    {} as Record<string, GQLPost>,
  );

  return campaigns.map((campaign) => ({
    campaign,
    post: mapped[campaign.postId],
  }));
};
