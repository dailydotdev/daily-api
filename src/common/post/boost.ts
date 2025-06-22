import { z } from 'zod';
import { ValidationError, ForbiddenError } from 'apollo-server-errors';
import { AuthContext } from '../../Context';
import { Bookmark, Post, PostType, type ConnectionManager } from '../../entity';
import { getPostPermalink } from '../../schema/posts';
import type { PromotedPost, PromotedPostList } from '../../integrations/skadi';
import type { Connection } from 'graphql-relay';
import { In } from 'typeorm';
import { mapCloudinaryUrl } from '../cloudinary';
import { pickImageUrl } from '../post';
import { NotFoundError } from '../../errors';
import { usdToCores } from '../njord';

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

const getBoostedPostBuilder = (con: ConnectionManager, alias = 'p1') =>
  con
    .getRepository(Post)
    .createQueryBuilder('p1')
    .select(`"${alias}".id`, 'id')
    .addSelect(`"${alias}"."shortId"`, 'shortId')
    .addSelect(`"${alias}".image`, 'image')
    .addSelect(`"${alias}".title`, 'title')
    .addSelect(`"${alias}".type`, 'type')
    .addSelect('p2.title', 'sharedTitle')
    .addSelect('p2.image', 'sharedImage')
    .leftJoin(Post, 'p2', `"${alias}"."sharedPostId" = p2.id`);

export const getBoostedPost = async (
  con: ConnectionManager,
  id: string,
): Promise<GetBoostedPost> => {
  const result = await getBoostedPostBuilder(con)
    .where('p1.id = :id', { id })
    .getRawOne();

  if (!result) {
    throw new NotFoundError('Post does not exist');
  }

  return result;
};

export const getFormattedBoostedPost = (
  post: GetBoostedPost,
): GQLBoostedPost['post'] => {
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

export const getFormattedCampaign = (campaign: PromotedPost): PromotedPost => ({
  ...campaign,
  budget: usdToCores(campaign.budget),
  currentBudget: usdToCores(campaign.currentBudget),
});

export interface BoostedPostStats
  extends Pick<PromotedPostList, 'clicks' | 'impressions' | 'totalSpend'> {
  engagements: number;
}

export interface BoostedPostConnection extends Connection<GQLBoostedPost> {
  stats?: BoostedPostStats;
}

export const consolidateCampaignsWithPosts = async (
  campaigns: PromotedPost[],
  con: ConnectionManager,
): Promise<GQLBoostedPost[]> => {
  const ids = campaigns.map(({ postId }) => postId);
  const posts = await getBoostedPostBuilder(con)
    .where('p1.id IN (:...ids)', { ids })
    .getRawMany<GetBoostedPost>();
  const mapped = posts.reduce(
    (map, post) => ({ ...map, [post.id]: post }),
    {} as Record<string, GetBoostedPost>,
  );

  return campaigns.map((campaign) => ({
    campaign: getFormattedCampaign(campaign),
    post: getFormattedBoostedPost(mapped[campaign.postId]),
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
    .select('SUM(upvotes)::int', 'upvotes')
    .addSelect('SUM(comments)::int', 'comments')
    .addSelect('SUM(views)::int', 'views')
    .addSelect(`(${bookmarks})::int`, 'bookmarks')
    .where({ id: In(postIds) })
    .getRawOne<TotalEngagements>();

  return Object.values(engagements!).reduce((total, stat) => total + stat, 0);
};
