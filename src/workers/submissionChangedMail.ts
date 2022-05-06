import { templateId } from './../common/mailing';
import { messageToJson, Worker } from './worker';
import { SubmissionStatus } from '../entity';
import { fetchUser } from '../common';
import { baseNotificationEmailData, sendEmail } from '../common';

interface Data {
  url: string;
  status: string;
  userId: string;
}

// TODO:: Update the dynamic template data once available

const worker: Worker = {
  subscription: 'submission-changed-mail',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);

    if (data.status === SubmissionStatus.Accepted) {
      return;
    }

    try {
      const user = await fetchUser(data.userId);
      await sendEmail({
        ...baseNotificationEmailData,
        to: user.email,
        templateId: templateId.postScoutMatched,
        dynamicTemplateData: {
          status: data.status,
          url: data.url,
        },
      });
      logger.info(
        { data, messageId: message.messageId },
        'email sent relating to submission status changed' + data.status,
      );
    } catch (err) {
      logger.error(
        { data, messageId: message.messageId, err },
        'failed to send submission status change mail',
      );
    }
  },
};

export default worker;
