import { TypedWorker } from './worker';
import { Post } from '../entity';
import type { DataSource } from 'typeorm';
import { notifyNewPostBoostedSlack, type PubSubSchema } from '../common';
import { skadiApiClientV1 } from '../integrations/skadi/api/v1/clients';

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
    post,
    campaign,
    userId,
  });
};
