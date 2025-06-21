import { z } from 'zod';
import { ValidationError, ForbiddenError } from 'apollo-server-errors';
import { AuthContext, type Context } from '../../Context';
import { Bookmark, Post, PostType, type ConnectionManager } from '../../entity';
import graphorm from '../../graphorm';
import { getPostPermalink, type GQLPost } from '../../schema/posts';
import type { GraphQLResolveInfo } from 'graphql';
import type { PromotedPost, PromotedPostList } from '../../integrations/skadi';
import type { Connection } from 'graphql-relay';
import { In } from 'typeorm';
import { mapCloudinaryUrl } from '../cloudinary';
import { pickImageUrl } from '../post';
import { NotFoundError } from '../../errors';

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

interface CampaignBoostedPost extends Pick<Post, 'id' | 'shortId' | 'title'> {
  image: string;
  permalink: string;
}

export interface GQLBoostedPost {
  campaign: PromotedPost;
  post: CampaignBoostedPost;
}

interface GetBoostedPost extends CampaignBoostedPost {
  type: PostType;
  sharedTitle?: string;
  sharedImage?: string;
}

export const getBoostedPost = async (
  con: ConnectionManager,
  id: string,
): Promise<GetBoostedPost> => {
  const result = await con
    .getRepository(Post)
    .createQueryBuilder('p1')
    .select('p1.id', 'id')
    .addSelect('p1."shortId"', 'shortId')
    .addSelect('p1.image', 'image')
    .addSelect('p1.title', 'title')
    .addSelect('p1.type', 'type')
    .addSelect('p2.title', 'sharedTitle')
    .addSelect('p2.image', 'sharedImage')
    .leftJoin(Post, 'p2', `p1."sharedPostId" = p2.id`)
    .where('p1.id = :id', { id })
    .getRawOne();

  if (!result) {
    throw new NotFoundError('Post does not exist');
  }

  return result;
};

export const getFormattedBoostedPost = async (
  post: GetBoostedPost,
): Promise<GQLBoostedPost['post']> => {
  const { id, shortId, sharedImage, sharedTitle } = post;
  let image: string | undefined = post.image;
  let title = post.title;

  if (post.type === PostType.Share) {
    image = sharedImage;
    title = title || sharedTitle;
  }

  return {
    id,
    shortId,
    title,
    image: mapCloudinaryUrl(image) ?? pickImageUrl({ createdAt: new Date() }),
    permalink: getPostPermalink({ shortId }),
  };
};

export interface BoostedPostStats
  extends Pick<PromotedPostList, 'clicks' | 'impressions' | 'totalSpend'> {
  engagements: number;
}

export interface BoostedPostConnection extends Connection<GQLBoostedPost> {
  stats?: BoostedPostStats;
}

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

interface TotalEngagements
  extends Pick<Post, 'views' | 'comments' | 'upvotes'> {
  bookmarks: number;
}

export const getTotalEngagements = async (
  con: ConnectionManager,
  postIds: string[],
): Promise<number> => {
  const builder = con.getRepository(Post).createQueryBuilder();
  const bookmarks = builder
    .subQuery()
    .createQueryBuilder()
    .select('COUNT(b.*)', 'bookmarks')
    .from(Bookmark, 'b')
    .where({ postId: In(postIds) })
    .getQuery();

  const engagements = await builder
    .select('SUM(upvotes)', 'upvotes')
    .addSelect('SUM(comments)', 'comments')
    .addSelect('SUM(views)', 'views')
    .addSelect(`(${bookmarks})`, 'bookmarks')
    .where({ id: In(postIds) })
    .getRawOne<TotalEngagements>();

  return Object.values(engagements!).reduce((total, stat) => total + stat, 0);
};
