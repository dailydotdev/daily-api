import { WebClient } from '@slack/web-api';
import { UserSourceIntegrationSlack } from '../entity/UserSourceIntegration';
import { TypedWorker } from './worker';
import fastq from 'fastq';
import { Post } from '../entity';

const sendQueueConcurrency = 10;

export const postAddedSlackChannelSendWorker: TypedWorker<'api.v1.post-visible'> =
  {
    subscription: 'api.post-added-slack-channel-send',
    handler: async (message, con, logger): Promise<void> => {
      const { data } = message;

      try {
        const [post, integrations] = await Promise.all([
          con.getRepository(Post).findOneOrFail({
            where: {
              id: data.post.id,
            },
            relations: {
              source: true,
            },
          }),
          con.getRepository(UserSourceIntegrationSlack).find({
            where: {
              sourceId: data.post.sourceId,
            },
            relations: {
              userIntegration: true,
            },
          }),
        ]);
        const source = await post.source;

        const sendQueue = fastq.promise(
          async ({
            integration,
            channelId,
          }: {
            integration: UserSourceIntegrationSlack;
            channelId: string;
          }) => {
            const userIntegration = await integration.userIntegration;
            const slackClient = new WebClient(userIntegration.meta.accessToken);

            // channel should already be joined when the integration is connected
            // but just in case
            await slackClient.conversations.join({
              channel: channelId,
            });

            await slackClient.chat.postMessage({
              channel: channelId,
              text: `New post added to source "${source.name}" - ${process.env.COMMENTS_PREFIX}/posts/${post.id}`,
            });
          },
          sendQueueConcurrency,
        );

        integrations.forEach((integration) => {
          integration.channelIds.forEach((channelId) => {
            sendQueue.push({ integration, channelId });
          });
        });

        await sendQueue.drained();
      } catch (err) {
        logger.error(
          {
            data,
            messageId: message.messageId,
            err,
          },
          'failed sending to slack channels',
        );
      }
    },
  };
