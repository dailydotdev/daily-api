import {
  schedulePersonalizedDigestSubscriptions,
  digestPreferredHourOffset,
  notifyGeneratePersonalizedDigest,
} from '../common';
import {
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
} from '../entity';
import { Cron } from './cron';

const sendType = UserPersonalizedDigestSendType.workdays;
const oneDay = 24 * 60 * 60 * 1000;

const cron: Cron = {
  name: 'daily-digest',
  handler: async (con, logger) => {
    const personalizedDigestQuery = con
      .createQueryBuilder()
      .from(UserPersonalizedDigest, 'upd')
      .where(
        '"preferredHour" - EXTRACT(HOUR FROM NOW() AT TIME ZONE "preferredTimezone") = :preferredHourOffset',
        {
          preferredHourOffset: digestPreferredHourOffset,
        },
      )
      .andWhere(`flags->>'sendType' = :sendType`, {
        sendType,
      });

    const timestamp = Date.now();

    await schedulePersonalizedDigestSubscriptions({
      queryBuilder: personalizedDigestQuery,
      logger,
      handler: async ({ personalizedDigest, emailBatchId }) => {
        const emailSendTimestamp = timestamp;
        const previousSendTimestamp = timestamp - oneDay;

        await notifyGeneratePersonalizedDigest({
          log: logger,
          personalizedDigest,
          emailSendTimestamp,
          previousSendTimestamp,
          emailBatchId,
        });
      },
      sendType,
    });
  },
};

export default cron;
