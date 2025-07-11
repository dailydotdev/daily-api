import { UserSourceIntegrationSlack } from '../entity/UserSourceIntegration';
import { TypedWorker } from './worker';
import fastq from 'fastq';
import {
  BRIEFING_SOURCE,
  PostType,
  UserPersonalizedDigest,
  UserPersonalizedDigestType,
} from '../entity';
import {
  getAttachmentForPostType,
  getSlackClient,
} from '../common/userIntegration';
import { addNotificationUtm } from '../common';
import { SlackApiError, SlackApiErrorCode } from '../errors';
import { counters } from '../telemetry/metrics';
import { BriefPost } from '../entity/posts/BriefPost';

const sendQueueConcurrency = 10;

export const postAddedSlackChannelSendBriefWorker: TypedWorker<'api.v1.post-visible'> =
  {
    subscription: 'api.post-added-slack-channel-send-brief',
    handler: async (message, con, logger): Promise<void> => {
      const { data } = message;

      try {
        if (data.post.sourceId !== BRIEFING_SOURCE) {
          return;
        }

        if (data.post.type !== PostType.Brief) {
          return;
        }

        if (!data.post.authorId) {
          return;
        }

        const [post, integrations, personalizedDigest] = await Promise.all([
          con.getRepository(BriefPost).findOneOrFail({
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
              userIntegration: {
                userId: data.post.authorId,
              },
            },
            relations: {
              userIntegration: true,
            },
          }),
          con.getRepository(UserPersonalizedDigest).findOne({
            where: {
              type: UserPersonalizedDigestType.Brief,
              userId: data.post.authorId,
            },
          }),
        ]);

        if (!personalizedDigest?.flags?.slack) {
          return;
        }

        if (integrations.length === 0) {
          return;
        }

        if (post.flags?.vordr) {
          return;
        }

        const source = await post.source;
        const postLinkPlain = `${process.env.COMMENTS_PREFIX}/posts/${post.slug}`;
        const postLinkUrl = new URL(postLinkPlain);
        const postLink = addNotificationUtm(
          postLinkUrl.toString(),
          'slack',
          'new_post',
        );

        const messageText = `<${postLink}|${postLinkPlain}>`;

        const attachment = await getAttachmentForPostType({
          con,
          post,
          postType: data.post.type,
          postLink,
        });

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
              try {
                await slackClient.conversations.join({
                  channel: channelId,
                });
              } catch (originalJoinError) {
                const conversationsJoinError =
                  originalJoinError as SlackApiError;

                if (
                  ![
                    SlackApiErrorCode.MethodNotSupportedForChannelType,
                  ].includes(
                    conversationsJoinError.data?.error as SlackApiErrorCode,
                  )
                ) {
                  throw originalJoinError;
                }
              }

              await slackClient.chat.postMessage({
                channel: channelId,
                text: messageText,
                attachments: [attachment],
                unfurl_links: false,
              });

              counters?.background?.postSentSlack?.add(1, {
                source: source.id,
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
