import { TypedWorker } from './worker';
import { Campaign, CampaignType, Post, Source } from '../entity';
import type { DataSource } from 'typeorm';
import {
  getDiscussionLink,
  getSourceLink,
  notifyNewPostBoostedSlack,
  type PubSubSchema,
} from '../common';

const worker: TypedWorker<'skadi.v1.campaign-updated'> = {
  subscription: 'api.campaign-updated-slack',
  handler: async (message, con): Promise<void> => {
    switch (message.data.action) {
      case 'started':
        return handlePostBoostStarted(con, message.data);
      default:
        return;
    }
  },
};

export default worker;

const sendMessagePost = async (con: DataSource, campaign: Campaign) => {
  const post = await con
    .getRepository(Post)
    .findOne({ where: { id: campaign.referenceId } });

  if (!post) {
    return;
  }

  await notifyNewPostBoostedSlack({
    mdLink: `<${getDiscussionLink(post.id)}|${post.id}>`,
    campaign,
    userId: campaign.userId,
  });
};

const sendMessageSource = async (con: DataSource, campaign: Campaign) => {
  const source = await con
    .getRepository(Source)
    .findOne({ where: { id: campaign.referenceId } });

  if (!source) {
    return;
  }

  await notifyNewPostBoostedSlack({
    mdLink: `<${getSourceLink(source)}|${source.id}>`,
    campaign,
    userId: campaign.userId,
  });
};

const handlePostBoostStarted = async (
  con: DataSource,
  { campaignId }: PubSubSchema['skadi.v1.campaign-updated'],
) => {
  const campaign = await con
    .getRepository(Campaign)
    .findOneBy({ id: campaignId });

  if (!campaign) {
    return;
  }

  switch (campaign.type) {
    case CampaignType.Post:
      sendMessagePost(con, campaign);
    case CampaignType.Source:
      sendMessageSource(con, campaign);
    default:
      break;
  }
};
