import { utcToZonedTime } from 'date-fns-tz';
import {
  schedulePersonalizedDigestSubscriptions,
  notifyGeneratePersonalizedDigest,
  DEFAULT_TIMEZONE,
  isWeekend,
  DEFAULT_WEEK_START,
} from '../common';
import {
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
  UserPersonalizedDigestType,
} from '../entity';
import { Cron } from './cron';
import { subDays } from 'date-fns';

const sendType = UserPersonalizedDigestSendType.workdays;
const digestTypes = [UserPersonalizedDigestType.StreakReminder];

const atTimeZone =
  "AT TIME ZONE COALESCE(NULLIF(u.timezone, ''), :defaultTimezone)";

const cron: Cron = {
  name: 'hourly-notification',
  handler: async (con, logger) => {
    const personalizedDigestQuery = con
      .createQueryBuilder()
      .select('upd.*, u.timezone, u."weekStart"')
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
        const {
          timezone = DEFAULT_TIMEZONE,
          weekStart = DEFAULT_WEEK_START,
          ...personalizedDigest
        } = personalizedDigestWithTimezome as UserPersonalizedDigest &
          Pick<User, 'timezone' | 'weekStart'>;

        const timestamp = new Date().getTime();
        const previousSendTimestamp = subDays(timestamp, 1).getTime();
        const sendDateInTimezone = utcToZonedTime(timestamp, timezone);
        if (isWeekend(sendDateInTimezone, weekStart)) {
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
