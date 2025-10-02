import { ValidationError } from 'apollo-server-errors';
import { AuthContext } from '../../Context';
import {
  CampaignPost,
  CampaignState,
  CampaignType,
  Post,
  type ConnectionManager,
  type FreeformPost,
  type SharePost,
} from '../../entity';
import { systemUser, updateFlagsStatement } from '../utils';
import { getDiscussionLink, notificationsLink } from '../links';
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
import type { NotificationCampaignContext } from '../../notifications';
import type { NotificationBuilder } from '../../notifications/builder';
import { NotificationIcon } from '../../notifications/icons';
import { formatMailDate, addNotificationEmailUtm } from '../mailing';
import { truncatePostToTweet } from '../twitter';
import type { TemplateDataFunc } from '../../workers/newNotificationV2Mail';

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
    const { budget, duration } = args;
    const total = budget * duration;
    const userId = ctx.userId;
    const endedAt = addDays(new Date(), duration);

    const campaign = await manager.getRepository(CampaignPost).save(
      manager.getRepository(CampaignPost).create({
        id,
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
      .getRepository(CampaignPost)
      .update({ id: campaignId }, { state: CampaignState.Cancelled });

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

export const generateCampaignPostNotification = (
  builder: NotificationBuilder,
  ctx: NotificationCampaignContext,
) => {
  const { campaign, event, user } = ctx;

  return builder
    .icon(NotificationIcon.DailyDev)
    .referenceCampaign(ctx)
    .targetUrl(notificationsLink)
    .setTargetUrlParameter([['c_id', campaign.id]])
    .uniqueKey(`${campaign.id}-${user.id}-${event}`)
    .avatarUser(user);
};

export const generateCampaignPostEmail: TemplateDataFunc = async (
  con,
  user,
  notification,
) => {
  const campaign = await con.getRepository(CampaignPost).findOne({
    where: { id: notification.referenceId },
    relations: ['post', 'post.sharedPost'],
  });

  if (!campaign) {
    return null;
  }

  const post = await campaign.post;
  const sharedPost = await (post as SharePost).sharedPost;
  const title = truncatePostToTweet(post || sharedPost);

  return {
    start_date: formatMailDate(campaign.createdAt),
    end_date: formatMailDate(campaign.endedAt),
    analytics_link: addNotificationEmailUtm(
      notification.targetUrl,
      notification.type,
    ),
    post_link: getDiscussionLink(post.slug),
    post_image: ((sharedPost || post) as FreeformPost)?.image,
    post_title: title,
  };
};
