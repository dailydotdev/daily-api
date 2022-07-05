import { formatMailDate } from './../common/mailing';
import { templateId } from '../common/mailing';
import { messageToJson, Worker } from './worker';
import { fetchUser } from '../common';
import { baseNotificationEmailData, sendEmail } from '../common';
import { SubmissionFailErrorMessage } from '../errors';
import { Submission } from '../entity';

type Data = Pick<Submission, 'url' | 'userId' | 'createdAt' | 'reason'>;

const worker: Worker = {
  subscription: 'community-link-rejected-mail',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    const date = new Date(data.createdAt);
    try {
      const user = await fetchUser(data.userId);
      await sendEmail({
        ...baseNotificationEmailData,
        to: user.email,
        templateId: templateId.communityLinkRejected,
        dynamicTemplateData: {
          submitted_at: formatMailDate(new Date(date.getTime() / 1000)),
          first_name: user.name.split(' ')[0],
          article_link: data.url,
          reason:
            SubmissionFailErrorMessage[data?.reason] ??
            SubmissionFailErrorMessage.GENERIC_ERROR,
        },
      });
      logger.info(
        { data, messageId: message.messageId },
        'email sent relating to submission status changed: rejected',
      );
    } catch (err) {
      logger.error(
        { data, messageId: message.messageId, err },
        'failed to send submission status rejected change mail',
      );
    }
  },
};

export default worker;
