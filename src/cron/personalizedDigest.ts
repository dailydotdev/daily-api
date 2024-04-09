import {
  getPersonalizedDigestPreviousSendDate,
  getPersonalizedDigestSendDate,
  notifyGeneratePersonalizedDigest,
  schedulePersonalizedDigestSubscriptions,
} from '../common';
import {
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
} from '../entity';
import { DEFAULT_TIMEZONE } from '../types';
import { Cron } from './cron';
import { Brackets } from 'typeorm';

const sendType = UserPersonalizedDigestSendType.weekly;

const cron: Cron = {
  name: 'personalized-digest',
  handler: async (con, logger) => {
    const nextPreferredDay = (new Date().getDay() + 1) % 7;
    const personalizedDigestQuery = con
      .createQueryBuilder()
      .select('upd.*, u.timezone')
      .from(UserPersonalizedDigest, 'upd')
      .leftJoin(User, 'u', 'u.id = upd."userId"')
      .where('upd."preferredDay" = :nextPreferredDay', {
        nextPreferredDay,
      })
      .andWhere(
        new Brackets((qb) => {
          return qb
            .where(`flags->>'sendType' IS NULL`)
            .orWhere(`flags->>'sendType' = :sendType`, {
              sendType,
            });
        }),
      );

    const timestamp = Date.now();

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
        const emailSendTimestamp = getPersonalizedDigestSendDate({
          personalizedDigest,
          generationTimestamp: timestamp,
          timezone: timezone,
        }).getTime();
        const previousSendTimestamp = getPersonalizedDigestPreviousSendDate({
          personalizedDigest,
          generationTimestamp: timestamp,
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
