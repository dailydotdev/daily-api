import { z } from 'zod';
import { ValidationError } from 'apollo-server-errors';
import { AuthContext } from '../../Context';
import { Bookmark, Post, PostType, type ConnectionManager } from '../../entity';
import { getPostPermalink } from '../../schema/posts';
import {
  type GetCampaignResponse,
  type PromotedPost,
  type PromotedPostList,
} from '../../integrations/skadi';
import type { Connection } from 'graphql-relay';
import { In, type SelectQueryBuilder } from 'typeorm';
import { mapCloudinaryUrl } from '../cloudinary';
import { pickImageUrl } from '../post';
import { NotFoundError } from '../../errors';
import { usdToCores } from '../njord';
import { debeziumTimeToDate, type ObjectSnakeToCamelCase } from '../utils';
import { getDiscussionLink } from '../links';

export interface GQLPromotedPost
  extends ObjectSnakeToCamelCase<
    Omit<PromotedPost, 'spend' | 'started_at' | 'ended_at'>
  > {
  spend: number;
  startedAt: Date;
  endedAt: Date;
}

export interface GQLPromotedPostList
  extends ObjectSnakeToCamelCase<Omit<PromotedPostList, 'total_spend'>> {
  totalSpend: number;
}

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
  if (!!post.flags?.campaignId) {
    throw new ValidationError('Post is already boosted');
  }
};

interface CampaignBoostedPost
  extends Pick<Post, 'id' | 'shortId' | 'title' | 'slug'> {
  image: string;
  permalink: string;
  engagements: number;
  commentsPermalink?: string;
}

export interface GQLBoostedPost {
  campaign: GQLPromotedPost;
  post: CampaignBoostedPost;
}

interface GetBoostedPost extends CampaignBoostedPost {
  type: PostType;
  sharedTitle?: string;
  sharedImage?: string;
  views: number;
  upvotes: number;
  comments: number;
  bookmarks: number;
}

const getBookmarksCountBuilder = (
  builder: SelectQueryBuilder<Post>,
  alias = 'b',
) =>
  builder
    .subQuery()
    .createQueryBuilder()
    .select(`COUNT("${alias}".*)`, 'bookmarks')
    .from(Bookmark, alias);

const getBoostedPostBuilder = (con: ConnectionManager, alias = 'p1') =>
  con
    .getRepository(Post)
    .createQueryBuilder(alias)
    .select(`"${alias}".id`, 'id')
    .addSelect(`"${alias}"."shortId"`, 'shortId')
    .addSelect(`"${alias}".slug`, 'slug')
    .addSelect(`"${alias}".image`, 'image')
    .addSelect(`"${alias}".title`, 'title')
    .addSelect(`"${alias}".type`, 'type')
    .addSelect(`"${alias}".upvotes::int`, 'upvotes')
    .addSelect(`"${alias}".comments::int`, 'comments')
    .addSelect(`"${alias}".views::int`, 'views')
    .addSelect('p2.title', 'sharedTitle')
    .addSelect('p2.image', 'sharedImage')
    .leftJoin(Post, 'p2', `"${alias}"."sharedPostId" = p2.id`);

export const getBoostedPost = async (
  con: ConnectionManager,
  id: string,
): Promise<GetBoostedPost> => {
  const builder = getBoostedPostBuilder(con);
  const bookmarks =
    getBookmarksCountBuilder(builder).where(`b."postId" = p1.id`);
  const result = await builder
    .addSelect(`(${bookmarks.getQuery()})::int`, 'bookmarks')
    .where({ id })
    .getRawOne();

  if (!result) {
    throw new NotFoundError('Post does not exist');
  }

  return result;
};

export const getFormattedBoostedPost = (
  post: GetBoostedPost,
  campaign: GetCampaignResponse,
): GQLBoostedPost['post'] => {
  const { id, shortId, sharedImage, sharedTitle, slug } = post;
  let image: string | undefined = post.image;
  let title = post.title;

  if (post.type === PostType.Share) {
    image = sharedImage;
    title = title || sharedTitle;
  }

  return {
    id,
    slug,
    shortId,
    title,
    image: mapCloudinaryUrl(image) ?? pickImageUrl({ createdAt: new Date() }),
    permalink: getPostPermalink({ shortId }),
    commentsPermalink: post.slug ? getDiscussionLink(post.slug) : undefined,
    engagements:
      post.bookmarks +
      post.comments +
      post.upvotes +
      post.views +
      campaign.impressions +
      campaign.clicks,
  };
};

export const getFormattedCampaign = ({
  spend,
  startedAt,
  endedAt,
  ...campaign
}: GetCampaignResponse): GQLPromotedPost => ({
  ...campaign,
  spend: usdToCores(parseFloat(spend)),
  startedAt: debeziumTimeToDate(startedAt),
  endedAt: debeziumTimeToDate(endedAt),
});

export interface BoostedPostStats
  extends Pick<GQLPromotedPostList, 'clicks' | 'impressions' | 'totalSpend'> {
  engagements: number;
}

export interface BoostedPostConnection extends Connection<GQLBoostedPost> {
  stats?: BoostedPostStats;
}

export const consolidateCampaignsWithPosts = async (
  campaigns: GetCampaignResponse[],
  con: ConnectionManager,
): Promise<GQLBoostedPost[]> => {
  const ids = campaigns.map(({ postId }) => postId);
  const builder = getBoostedPostBuilder(con);
  const postAlias = 'p1';
  const bookmarkAlias = 'b';
  const bookmarks = getBookmarksCountBuilder(builder).where(
    `"${bookmarkAlias}"."postId" = "${postAlias}".id`,
  );
  const posts = await builder
    .addSelect(`(${bookmarks.getQuery()})::int`, 'bookmarks')
    .where(`"${postAlias}".id IN (:...ids)`, { ids })
    .getRawMany<GetBoostedPost>();
  const mapped = posts.reduce(
    (map, post) => ({ ...map, [post.id]: post }),
    {} as Record<string, GetBoostedPost>,
  );

  return campaigns.map((campaign) => ({
    campaign: getFormattedCampaign(campaign),
    post: getFormattedBoostedPost(mapped[campaign.postId], campaign),
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
