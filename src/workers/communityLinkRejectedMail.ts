import { formatMailDate } from './../common/mailing';
import { templateId } from '../common/mailing';
import { messageToJson, Worker } from './worker';
import { fetchUser } from '../common';
import { baseNotificationEmailData, sendEmail } from '../common';

interface Data {
  url: string;
  userId: string;
  createdAt: Date;
}

const worker: Worker = {
  subscription: 'community-link-rejected-mail',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const user = await fetchUser(data.userId);
      await sendEmail({
        ...baseNotificationEmailData,
        to: user.email,
        templateId: templateId.communityLinkRejected,
        dynamicTemplateData: {
          submitted_at: formatMailDate(new Date(data.createdAt)),
          first_name: user.name.split(' ')[0],
          article_link: data.url,
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
