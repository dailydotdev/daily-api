import { utcToZonedTime } from 'date-fns-tz';
import {
  schedulePersonalizedDigestSubscriptions,
  notifyGeneratePersonalizedDigest,
} from '../common';
import {
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
  UserPersonalizedDigestType,
} from '../entity';
import { Cron } from './cron';
import { isWeekend, subDays } from 'date-fns';
import { DEFAULT_TIMEZONE } from '../types';

const sendType = UserPersonalizedDigestSendType.workdays;
const digestTypes = [UserPersonalizedDigestType.StreakReminder];

const atTimeZone =
  "AT TIME ZONE COALESCE(NULLIF(u.timezone, ''), :defaultTimezone)";

const cron: Cron = {
  name: 'hourly-notification',
  handler: async (con, logger) => {
    const personalizedDigestQuery = con
      .createQueryBuilder()
      .select('upd.*, u.timezone')
      .from(UserPersonalizedDigest, 'upd')
      .innerJoin(User, 'u', 'u.id = upd."userId"')
      .where(
        `clamp_to_hours(upd."preferredHour" - EXTRACT(HOUR FROM NOW() ${atTimeZone})) = 1`,
        {
          defaultTimezone: DEFAULT_TIMEZONE,
        },
      )
      .andWhere(`upd.flags->>'sendType' = :sendType`, { sendType })
      .andWhere(`upd.type in (:...digestTypes)`, { digestTypes });

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

        const timestamp = new Date().getTime();
        const previousSendTimestamp = subDays(timestamp, 1).getTime();
        const sendDateInTimezone = utcToZonedTime(timestamp, timezone);
        if (isWeekend(sendDateInTimezone)) {
          return;
        }

        await notifyGeneratePersonalizedDigest({
          log: logger,
          personalizedDigest,
          emailSendTimestamp: timestamp,
          previousSendTimestamp,
          emailBatchId,
        });
      },
      sendType,
    });
  },
};

export default cron;
