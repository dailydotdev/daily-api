import { Alerts, UserTopReader } from '../../entity';
import { retryFetch } from '../../integrations/retry';
import { logger } from '../../logger';
import { generateTypedNotificationWorker } from './worker';
import { uploadFile, UploadPreset } from '../../common';
import { Readable } from 'stream';
import { NotificationType } from '../../notifications/common';
import { WEBAPP_MAGIC_IMAGE_PREFIX } from '../../config';

export const userTopReaderAdded =
  generateTypedNotificationWorker<'api.v1.user-top-reader'>({
    subscription: 'api.user-top-reader-added',
    handler: async ({ userTopReader }, con) => {
      const { id, userId, keywordValue } = userTopReader;
      const topReader = await con.getRepository(UserTopReader).findOneBy({
        id,
        userId,
      });
      if (!topReader) {
        logger.error(
          { id, userId, keywordValue },
          'userTopReaderAdded: Top reader not found',
        );
        return;
      }

      const keyword = await topReader.keyword;
      if (!keyword) {
        logger.error(
          { id, userId, keywordValue },
          'userTopReaderAdded: Keyword not found',
        );
        return;
      }

      const url = new URL(
        `${WEBAPP_MAGIC_IMAGE_PREFIX}/badges/${id}`,
        process.env.COMMENTS_PREFIX,
      );

      logger.info(
        { id, userId },
        'userTopReaderAdded: Generating screenshot of badge',
      );
      const response = await retryFetch(
        `${process.env.SCRAPER_URL}/screenshot`,
        {
          method: 'POST',
          body: JSON.stringify({ url, selector: '#screenshot_wrapper' }),
          headers: { 'content-type': 'application/json' },
        },
      );

      logger.info(
        { id, userId },
        'userTopReaderAdded: Uploading screenshot to cloudinary',
      );
      const uploadedImage = await uploadFile(
        id,
        UploadPreset.TopReaderBadge,
        Readable.from(response.body),
      );

      await con.transaction(async (manager) => {
        await manager.getRepository(UserTopReader).update(
          { id },
          {
            image: uploadedImage.url,
          },
        );

        await manager.getRepository(Alerts).update(
          { userId },
          {
            showTopReader: true,
          },
        );
      });

      return [
        {
          type: NotificationType.UserTopReaderBadge,
          ctx: {
            userIds: [userId],
            userTopReader: topReader,
            keyword: keyword,
          },
        },
      ];
    },
  });
