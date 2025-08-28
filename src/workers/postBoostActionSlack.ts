import { TypedWorker } from './worker';
import { CampaignType, Post } from '../entity';
import type { DataSource } from 'typeorm';
import {
  debeziumTimeToDate,
  getDiscussionLink,
  notifyNewPostBoostedSlack,
  type PubSubSchema,
} from '../common';
import { skadiApiClientV1 } from '../integrations/skadi/api/v1/clients';
import { usdToCores } from '../common/number';

const worker: TypedWorker<'skadi.v1.campaign-updated'> = {
  subscription: 'api.campaign-updated-slack-v2',
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

const handlePostBoostStarted = async (
  con: DataSource,
  { postId, campaignId, userId }: PubSubSchema['skadi.v1.campaign-updated'],
) => {
  if (process.env.NODE_ENV === 'development') {
    return;
  }

  const post = await con.getRepository(Post).findOne({ where: { id: postId } });

  if (!post) {
    return;
  }

  const campaign = await skadiApiClientV1.getCampaignById({
    campaignId,
    userId,
  });

  if (!campaign) {
    return;
  }

  await notifyNewPostBoostedSlack({
    campaign: {
      id: campaign.campaignId,
      createdAt: debeziumTimeToDate(campaign.startedAt),
      endedAt: debeziumTimeToDate(campaign.endedAt),
      type: CampaignType.Post,
      flags: { budget: usdToCores(parseFloat(campaign.budget)) },
      userId,
    },
    mdLink: `<${getDiscussionLink(post.id)}|${post.id}>`,
  });
};
