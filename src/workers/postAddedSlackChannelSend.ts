import { UserSourceIntegrationSlack } from '../entity/UserSourceIntegration';
import { TypedWorker } from './worker';
import fastq from 'fastq';
import { Post, SourceType } from '../entity';
import {
  getAttachmentForPostType,
  getSlackClient,
} from '../common/userIntegration';
import { addNotificationUtm } from '../common';

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
              author: true,
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
          source.type === SourceType.Squad ? 'Squad' : 'source';

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
              const slackClient = await getSlackClient({
                integration: userIntegration,
              });

              // channel should already be joined when the integration is connected
              // but just in case
              await slackClient.conversations.join({
                channel: channelId,
              });

              const postLinkPlain = `${process.env.COMMENTS_PREFIX}/posts/${post.id}`;
              const postLink = addNotificationUtm(
                postLinkPlain,
                'slack',
                'new_post',
              );
              let message = `New post on "${source.name}" ${sourceTypeName}. <${postLink}|${postLinkPlain}>`;
              const author = await post.author;
              const authorName = author?.name || author?.username;

              if (sourceTypeName === 'Squad' && authorName) {
                message = `${authorName} shared a new post on "${source.name}" ${sourceTypeName}. ${process.env.COMMENTS_PREFIX}/posts/${post.id}`;
              }

              const attachment = await getAttachmentForPostType({
                con,
                post,
                postType: data.post.type,
                postLink,
              });

              await slackClient.chat.postMessage({
                channel: channelId,
                text: message,
                attachments: [attachment],
                unfurl_links: false,
              });
            } catch (originalError) {
              const error = originalError as Error;

              logger.error(
                {
                  data: {
                    integrationId: userIntegration.id,
                    sourceId: data.post.sourceId,
                    channelId,
                  },
                  messageId: message.messageId,
                  err: error,
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
