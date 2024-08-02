import { WebClient } from '@slack/web-api';
import { UserSourceIntegrationSlack } from '../entity/UserSourceIntegration';
import { TypedWorker } from './worker';
import fastq from 'fastq';
import { Post, SourceType } from '../entity';
import { getIntegrationToken } from '../common';

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

        const sourceTypeName =
          source.type === SourceType.Squad ? 'squad' : 'source';

        const sendQueue = fastq.promise(
          async ({
            integration,
            channelId,
          }: {
            integration: UserSourceIntegrationSlack;
            channelId: string;
          }) => {
            const userIntegration = await integration.userIntegration;

            try {
              const slackClient = new WebClient(
                await getIntegrationToken({ integration: userIntegration }),
              );

              // channel should already be joined when the integration is connected
              // but just in case
              await slackClient.conversations.join({
                channel: channelId,
              });

              await slackClient.chat.postMessage({
                channel: channelId,
                text: `New post added to ${sourceTypeName} "${source.name}" ${process.env.COMMENTS_PREFIX}/posts/${post.id}`,
              });
            } catch (originalError) {
              const error = originalError as Error;

              logger.error(
                {
                  integrationId: userIntegration.id,
                  sourceId: data.post.sourceId,
                  channelId,
                  error: error.message,
                },
                'failed to send slack message',
              );
            }
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
