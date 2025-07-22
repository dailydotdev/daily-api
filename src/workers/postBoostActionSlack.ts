import { TypedWorker } from './worker';
import { Post } from '../entity';
import type { DataSource } from 'typeorm';
import { notifyNewPostBoostedSlack, type PubSubSchema } from '../common';
import { skadiApiClient } from '../integrations/skadi/api/clients';

const worker: TypedWorker<'api.v1.post-boost-action'> = {
  subscription: 'api.post-boost-action-slack',
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
  { postId, campaignId, userId }: PubSubSchema['api.v1.post-boost-action'],
) => {
  const post = await con
    .getRepository(Post)
    .findOneOrFail({ where: { id: postId } });

  if (!post) {
    return;
  }

  const campaign = await skadiApiClient.getCampaignById({ campaignId, userId });

  if (!campaign) {
    return;
  }

  await notifyNewPostBoostedSlack(post, campaign, userId);
};
