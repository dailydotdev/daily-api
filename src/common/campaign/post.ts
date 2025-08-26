import { ValidationError } from 'apollo-server-errors';
import { AuthContext } from '../../Context';
import {
  ArticlePost,
  CampaignPost,
  CampaignState,
  CampaignType,
  Post,
  PostType,
  type ConnectionManager,
  type FreeformPost,
  type SharePost,
} from '../../entity';
import { getPostPermalink } from '../../schema/posts';
import {
  type GetCampaignListResponse,
  type GetCampaignResponse,
} from '../../integrations/skadi';
import type { Connection } from 'graphql-relay';
import { In } from 'typeorm';
import { mapCloudinaryUrl } from '../cloudinary';
import { pickImageUrl } from '../post';
import { NotFoundError } from '../../errors';
import { debeziumTimeToDate, systemUser, updateFlagsStatement } from '../utils';
import { getDiscussionLink } from '../links';
import { skadiApiClientV1 } from '../../integrations/skadi/api/v1/clients';
import { largeNumberFormat } from '../devcard';
import { formatMailDate, addNotificationEmailUtm } from '../mailing';
import { truncatePostToTweet } from '../twitter';
import type { TemplateDataFunc } from '../../workers/newNotificationV2Mail';
import { usdToCores } from '../number';

import {
  startCampaignTransferCores,
  stopCampaignTransferCores,
  type StartCampaignMutationArgs,
  type StopCampaignProps,
} from './common';
import { randomUUID } from 'crypto';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
  UserTransactionType,
} from '../../entity/user/UserTransaction';
import { addDays } from 'date-fns';
import { skadiApiClientV2 } from '../../integrations/skadi/api/v2/clients';

export interface GQLPromotedPost
  extends Omit<
    GetCampaignResponse,
    'spend' | 'budget' | 'startedAt' | 'endedAt'
  > {
  spend: number;
  budget: number;
  startedAt: Date;
  endedAt: Date;
}

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
}

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
  const result = await getBoostedPostBuilder(con).where({ id }).getRawOne();

  if (!result) {
    throw new NotFoundError('Post does not exist');
  }

  return result;
};

export const getFormattedBoostedPost = (
  post: GetBoostedPost,
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
    engagements: post.comments + post.upvotes + post.views,
  };
};

export const getFormattedCampaign = ({
  spend,
  budget,
  startedAt,
  endedAt,
  ...campaign
}: GetCampaignResponse): GQLPromotedPost => ({
  ...campaign,
  spend: usdToCores(parseFloat(spend)),
  budget: usdToCores(parseFloat(budget)),
  startedAt: debeziumTimeToDate(startedAt),
  endedAt: debeziumTimeToDate(endedAt),
});

export interface BoostedPostStats
  extends Pick<GetCampaignListResponse, 'clicks' | 'impressions' | 'users'> {
  engagements: number;
  totalSpend: number;
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
  const posts = await builder
    .where(`"${postAlias}".id IN (:...ids)`, { ids })
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
  extends Pick<Post, 'views' | 'comments' | 'upvotes'> {}

export const getTotalEngagements = async (
  con: ConnectionManager,
  postIds: string[],
): Promise<number> => {
  const builder = con.getRepository(Post).createQueryBuilder();

  const engagements = await builder
    .select('SUM(upvotes)::int', 'upvotes')
    .addSelect('SUM(comments)::int', 'comments')
    .addSelect('SUM(views)::int', 'views')
    .where({ id: In(postIds) })
    .getRawOne<TotalEngagements>();

  return (
    (engagements?.upvotes || 0) +
    (engagements?.comments || 0) +
    (engagements?.views || 0)
  );
};

export const generateBoostEmailUpdate: TemplateDataFunc = async (
  con,
  user,
  notification,
) => {
  const campaign = await skadiApiClientV1.getCampaignById({
    campaignId: notification.referenceId!,
    userId: user.id,
  });

  if (!campaign) {
    return null;
  }

  const post = await con.getRepository(Post).findOne({
    where: { id: campaign.postId },
  });

  if (!post) {
    return null;
  }

  const sharedPost = await (post.type === PostType.Share
    ? con.getRepository(ArticlePost).findOne({
        where: { id: (post as SharePost).sharedPostId },
        select: ['title', 'image', 'slug'],
      })
    : Promise.resolve(null));

  const title = truncatePostToTweet(post || sharedPost);
  const engagement = post.views + post.upvotes + post.comments;

  return {
    start_date: formatMailDate(debeziumTimeToDate(campaign.startedAt)),
    end_date: formatMailDate(debeziumTimeToDate(campaign.endedAt)),
    impressions: largeNumberFormat(campaign.impressions),
    clicks: largeNumberFormat(campaign.clicks),
    engagement: largeNumberFormat(engagement),
    post_link: getDiscussionLink(post.slug),
    analytics_link: addNotificationEmailUtm(
      notification.targetUrl,
      notification.type,
    ),
    post_image: sharedPost?.image || (post as FreeformPost).image,
    post_title: title,
  };
};

export const getAdjustedReach = (value: number) => {
  // We do plus-minus 8% of the generated value
  const difference = Math.floor(value * 0.08);
  const min = Math.max(value - difference, 0);
  const estimatedReach = {
    min,
    max: Math.max(value + difference, min),
  };

  return estimatedReach;
};

export const startCampaignPost = async (props: StartCampaignMutationArgs) => {
  const { ctx, args } = props;
  const { value: postId } = args;
  const post = await validatePostBoostPermissions(ctx, postId);
  checkPostAlreadyBoosted(post);

  const request = await ctx.con.transaction(async (manager) => {
    const id = randomUUID();
    const creativeId = randomUUID();
    const { budget, duration } = args;
    const total = budget * duration;
    const userId = ctx.userId;
    const endedAt = addDays(new Date(), duration);

    const campaign = await manager.getRepository(CampaignPost).save(
      manager.getRepository(CampaignPost).create({
        id,
        creativeId,
        flags: {
          budget: total,
          spend: 0,
          users: 0,
          clicks: 0,
          impressions: 0,
        },
        userId,
        referenceId: postId,
        state: CampaignState.Active,
        endedAt,
        postId,
        type: CampaignType.Post,
      }),
    );

    const campaignId = campaign.id;
    const tags = await getPostTags(manager, postId);

    await skadiApiClientV2.startCampaign(campaign, tags);

    await manager
      .getRepository(Post)
      .update(
        { id: postId },
        { flags: updateFlagsStatement<Post>({ campaignId: id }) },
      );

    const userTransaction = await manager.getRepository(UserTransaction).save(
      manager.getRepository(UserTransaction).create({
        id: randomUUID(),
        processor: UserTransactionProcessor.Njord,
        receiverId: systemUser.id,
        status: UserTransactionStatus.Success,
        productId: null,
        senderId: userId,
        value: total,
        valueIncFees: 0,
        fee: 0,
        request: ctx.requestMeta,
        flags: { note: `Post Boost started` },
        referenceId: campaignId,
        referenceType: UserTransactionType.PostBoost,
      }),
    );

    return await startCampaignTransferCores({
      ctx,
      manager,
      campaignId,
      userTransaction,
    });
  });

  return request.transaction;
};

export const stopCampaignPost = async ({
  campaign,
  ctx,
}: StopCampaignProps) => {
  const { id: campaignId, userId, referenceId } = campaign;

  const { budget } = await skadiApiClientV2.cancelCampaign({
    campaignId,
    userId,
  });

  const result = await ctx.con.transaction(async (manager) => {
    const toRefund = parseFloat(budget);

    await manager
      .getRepository(Post)
      .update(
        { id: referenceId },
        { flags: updateFlagsStatement<Post>({ campaignId: null }) },
      );

    const userTransaction = await manager.getRepository(UserTransaction).save(
      manager.getRepository(UserTransaction).create({
        id: randomUUID(),
        processor: UserTransactionProcessor.Njord,
        receiverId: userId,
        status: UserTransactionStatus.Success,
        productId: null,
        senderId: systemUser.id,
        value: usdToCores(toRefund),
        valueIncFees: 0,
        fee: 0,
        flags: { note: `Post Boost refund` },
        referenceId: campaignId,
        referenceType: UserTransactionType.PostBoost,
      }),
    );

    return await stopCampaignTransferCores({
      ctx,
      manager,
      campaignId,
      userTransaction,
    });
  });

  return result.transaction;
};

export const getPostTags = async (con: ConnectionManager, postId: string) => {
  const builder = con.getRepository(Post).createQueryBuilder('p1');
  const subquery = builder
    .subQuery()
    .select(`COALESCE(p2."tagsStr", '')`)
    .from(Post, 'p2')
    .where('p2.id = p1."sharedPostId"')
    .getQuery();

  const result = await builder
    .select(`COALESCE(p1."tagsStr", '')`, 'tagsStr')
    .addSelect(`(${subquery})`, 'sharedTagsStr')
    .where('p1.id = :id', { id: postId })
    .getRawOne<{ tagsStr: string; sharedTagsStr: string }>();

  const tags1 = (result?.tagsStr ?? '').split(',');
  const tags2 = (result?.sharedTagsStr ?? '').split(',');
  const list = [...tags1, ...tags2].filter((tag) => tag.trim().length > 0);

  return Array.from(new Set(list));
};
