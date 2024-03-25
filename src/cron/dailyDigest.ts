import { utcToZonedTime } from 'date-fns-tz';
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
import { isWeekend } from 'date-fns';

const sendType = UserPersonalizedDigestSendType.workdays;
const oneHourMs = 60 * 60 * 1000;
const oneDayMs = 24 * oneHourMs;

const cron: Cron = {
  name: 'daily-digest',
  handler: async (con, logger) => {
    const personalizedDigestQuery = con
      .createQueryBuilder()
      .from(UserPersonalizedDigest, 'upd')
      .where(
        'clamp_to_hours("preferredHour" - EXTRACT(HOUR FROM NOW() AT TIME ZONE "preferredTimezone")) = :preferredHourOffset',
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
        const hourOffsetMs = digestPreferredHourOffset * oneHourMs;
        const emailSendTimestamp = timestamp + hourOffsetMs; // schedule send in X hours to match digest offset
        const previousSendTimestamp = timestamp - oneDayMs;

        const sendDateInTimezone = utcToZonedTime(
          emailSendTimestamp,
          personalizedDigest.preferredTimezone,
        );

        if (isWeekend(sendDateInTimezone)) {
          return;
        }

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
