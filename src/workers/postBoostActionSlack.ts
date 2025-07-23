import { TypedWorker } from './worker';
import { Post, type SharePost } from '../entity';
import type { DataSource } from 'typeorm';
import { notifyNewPostBoostedSlack, type PubSubSchema } from '../common';
import { skadiApiClient } from '../integrations/skadi/api/clients';

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

  const sharedPostId = (post as SharePost).sharedPostId;
  const sharedPost = !!sharedPostId
    ? await con.getRepository(Post).findOne({
        where: { id: sharedPostId },
        select: ['title'],
      })
    : await Promise.resolve(null);

  await notifyNewPostBoostedSlack(post, campaign, userId, sharedPost?.title);
};
