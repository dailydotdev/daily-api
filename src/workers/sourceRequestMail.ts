import { formatMailDate, templateId } from '../common/mailing';
import { messageToJson, Worker } from './worker';
import { fetchUser, NotificationReason } from '../common';
import { baseNotificationEmailData, sendEmail } from '../common';
import { SourceRequest } from '../entity';

type Data = {
  reason: NotificationReason;
  sourceRequest: Pick<
    SourceRequest,
    'userId' | 'createdAt' | 'sourceName' | 'sourceUrl' | 'reason'
  >;
};

const templateIds = {
  [NotificationReason.Approve]: templateId.sourceRequestApproved,
  [NotificationReason.Decline]: templateId.sourceRequestDeclined,
  [NotificationReason.New]: templateId.sourceRequestSubmitted,
};

const worker: Worker = {
  subscription: 'source-request-mail',
  handler: async (message, _, logger): Promise<void> => {
    const { reason, sourceRequest }: Data = messageToJson(message);

    const date = new Date(sourceRequest.createdAt);
    try {
      let mailTemplateId = templateIds[reason];
      if (
        reason === NotificationReason.Decline &&
        sourceRequest.reason === NotificationReason.Exists
      ) {
        mailTemplateId = templateIds[NotificationReason.Approve];
      }
      if (!mailTemplateId) return;

      const user = await fetchUser(sourceRequest.userId);
      await sendEmail({
        ...baseNotificationEmailData,
        to: user.email,
        templateId: mailTemplateId,
        dynamicTemplateData: {
          source_name: sourceRequest.sourceName,
          rss_link: sourceRequest.sourceUrl,
          first_name: user.name.split(' ')[0],
          timestamp: formatMailDate(new Date(date.getTime() / 1000)),
        },
      });
      logger.info(
        { reason, sourceRequest, messageId: message.messageId },
        'email sent for submitting source request',
      );
    } catch (err) {
      logger.error(
        { reason, sourceRequest, messageId: message.messageId, err },
        'failed to send mail relating to submitting source request',
      );
    }
  },
};

export default worker;
