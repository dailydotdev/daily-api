import { addHours, startOfHour } from 'date-fns';
import {
  DEFAULT_TIMEZONE,
  getPersonalizedDigestPreviousSendDate,
  digestPreferredHourOffset,
  notifyGeneratePersonalizedDigest,
  schedulePersonalizedDigestSubscriptions,
} from '../common';
import {
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
  UserPersonalizedDigestType,
} from '../entity';
import { Cron } from './cron';
import { Brackets } from 'typeorm';

const sendType = UserPersonalizedDigestSendType.weekly;
const digestTypes = [UserPersonalizedDigestType.Digest];

const cron: Cron = {
  name: 'personalized-digest',
  handler: async (con, logger) => {
    const personalizedDigestQuery = con
      .createQueryBuilder()
      .select('upd.*, u.timezone')
      .from(UserPersonalizedDigest, 'upd')
      .leftJoin(User, 'u', 'u.id = upd."userId"')
      .where(
        `(EXTRACT(DAY FROM NOW() AT TIME ZONE COALESCE(NULLIF(u.timezone, ''), '${DEFAULT_TIMEZONE}')) - 1) = upd."preferredDay"`,
        {
          defaultTimezone: DEFAULT_TIMEZONE,
        },
      )
      .andWhere(
        `clamp_to_hours("preferredHour" - EXTRACT(HOUR FROM NOW() AT TIME ZONE COALESCE(NULLIF(u.timezone, ''), :defaultTimezone))) = :preferredHourOffset`,
        {
          preferredHourOffset: digestPreferredHourOffset,
          defaultTimezone: DEFAULT_TIMEZONE,
        },
      )
      .andWhere(
        new Brackets((qb) => {
          return qb
            .where(`upd.flags->>'sendType' IS NULL`)
            .orWhere(`upd.flags->>'sendType' = :sendType`, {
              sendType,
            });
        }),
      )
      .andWhere(`upd.type in (:...digestTypes)`, { digestTypes });

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
            Pick<User, 'timezone' | 'weekStart'>;
        const emailSendTimestamp = addHours(
          timestamp,
          digestPreferredHourOffset,
        ).getTime(); // schedule send in X hours to match digest offset
        const previousSendTimestamp = getPersonalizedDigestPreviousSendDate({
          personalizedDigest,
          generationTimestamp: timestamp.getTime(),
          timezone: timezone,
        }).getTime();

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
