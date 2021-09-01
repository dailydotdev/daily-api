import { DeepPartial } from 'typeorm';
import { messageToJson, Worker } from './worker';
import {
  getDevCardData,
  largeNumberFormat,
  transformTag,
} from '../common/devcard';
import { baseNotificationEmailData, sendEmail } from '../common';

const worker: Worker = {
  subscription: 'devcard-eligible-email',
  handler: async (message, con, logger): Promise<void> => {
    const data: DeepPartial<{ userId: string }> = messageToJson(message);
    try {
      const { user, articlesRead, tags, sourcesLogos, rank } =
        await getDevCardData(data.userId, con);
      const clampedRank = Math.max(rank.currentRank, 1);
      const tagsData = tags.reduce(
        (acc, { value, count }, index) => ({
          ...acc,
          [`tag${index + 1}`]: transformTag(value),
          [`tag_count${index + 1}`]: largeNumberFormat(count),
        }),
        {},
      );
      const sourcesData = sourcesLogos.reduce(
        (acc, logo, index) => ({
          ...acc,
          [`publication${index + 1}`]: logo,
        }),
        {},
      );
      await sendEmail({
        ...baseNotificationEmailData,
        to: user.email,
        templateId: 'd-680e36a387084cac87923963ea0656db',
        dynamicTemplateData: {
          rank: `https://daily-now-res.cloudinary.com/image/upload/emails/devcard/rank_${clampedRank}.png`,
          banner: `https://daily-now-res.cloudinary.com/image/upload/emails/devcard/banner_${clampedRank}.jpg`,
          articles_read: largeNumberFormat(articlesRead),
          full_name: user.name,
          profile_image: user.image,
          ...tagsData,
          ...sourcesData,
        },
      });
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to send devcard eligibility email',
      );
    }
  },
};

export default worker;
