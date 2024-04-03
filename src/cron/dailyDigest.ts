import { utcToZonedTime } from 'date-fns-tz';
import {
  schedulePersonalizedDigestSubscriptions,
  digestPreferredHourOffset,
  notifyGeneratePersonalizedDigest,
} from '../common';
import {
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
} from '../entity';
import { Cron } from './cron';
import { isWeekend, addHours, startOfHour, subDays } from 'date-fns';
import { DEFAULT_TIMEZONE } from '../types';

const sendType = UserPersonalizedDigestSendType.workdays;

const cron: Cron = {
  name: 'daily-digest',
  handler: async (con, logger) => {
    const personalizedDigestQuery = con
      .createQueryBuilder()
      .select('upd.*, u.timezone')
      .from(UserPersonalizedDigest, 'upd')
      .innerJoin(User, 'u', 'u.id = upd."userId"')
      .where(
        `clamp_to_hours("preferredHour" - EXTRACT(HOUR FROM NOW() AT TIME ZONE COALESCE(NULLIF(u.timezone, ''), :defaultTimezone))) = :preferredHourOffset`,
        {
          preferredHourOffset: digestPreferredHourOffset,
          defaultTimezone: DEFAULT_TIMEZONE,
        },
      )
      .andWhere(`flags->>'sendType' = :sendType`, {
        sendType,
      });

    // Make sure digest is sent at the beginning of the hour
    const timestamp = startOfHour(new Date());

    await schedulePersonalizedDigestSubscriptions({
      queryBuilder: personalizedDigestQuery,
      logger,
      handler: async ({
        personalizedDigest: personalizedDigestWithTimezome,
        emailBatchId,
      }) => {
        const { timezone = DEFAULT_TIMEZONE, ...personalizedDigest } =
          personalizedDigestWithTimezome as UserPersonalizedDigest &
            Pick<User, 'timezone'>;
        const emailSendTimestamp = addHours(
          timestamp,
          digestPreferredHourOffset,
        ).getTime(); // schedule send in X hours to match digest offset
        const previousSendTimestamp = subDays(timestamp, 1).getTime();

        const sendDateInTimezone = utcToZonedTime(emailSendTimestamp, timezone);

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
