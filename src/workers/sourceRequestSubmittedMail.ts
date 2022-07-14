import { formatMailDate, templateId } from '../common/mailing';
import { messageToJson, Worker } from './worker';
import { fetchUser } from '../common';
import { baseNotificationEmailData, sendEmail } from '../common';
import { SourceRequest } from '../entity';

type Data = Pick<
  SourceRequest,
  'userId' | 'createdAt' | 'sourceName' | 'sourceUrl'
>;

const worker: Worker = {
  subscription: 'source-request-submitted-mail',
  handler: async (message, _, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    const date = new Date(data.createdAt);
    try {
      const user = await fetchUser(data.userId);
      await sendEmail({
        ...baseNotificationEmailData,
        to: user.email,
        templateId: templateId.sourceRequestSubmitted,
        dynamicTemplateData: {
          source_name: data.sourceName,
          rss_link: data.sourceUrl,
          first_name: user.name.split(' ')[0],
          timestamp: formatMailDate(new Date(date.getTime() / 1000)),
        },
      });
      logger.info(
        { data, messageId: message.messageId },
        'email sent for submitting source request',
      );
    } catch (err) {
      logger.error(
        { data, messageId: message.messageId, err },
        'failed to send mail relating to submitting source request',
      );
    }
  },
};

export default worker;
