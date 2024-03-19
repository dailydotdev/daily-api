import {
  getPersonalizedDigestPreviousSendDate,
  getPersonalizedDigestSendDate,
  notifyGeneratePersonalizedDigest,
  schedulePersonalizedDigestSubscriptions,
} from '../common';
import {
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
} from '../entity';
import { Cron } from './cron';
import { Brackets } from 'typeorm';

const sendType = UserPersonalizedDigestSendType.weekly;

const cron: Cron = {
  name: 'personalized-digest',
  handler: async (con, logger) => {
    const nextPreferredDay = (new Date().getDay() + 1) % 7;
    const personalizedDigestQuery = con
      .createQueryBuilder()
      .from(UserPersonalizedDigest, 'upd')
      .where('upd."preferredDay" = :nextPreferredDay', {
        nextPreferredDay,
      })
      .andWhere(
        new Brackets((qb) => {
          return qb
            .where(`flags->>'sendType' IS NULL`)
            .orWhere(`flags->>'sendType' = :sendType`, {
              sendType: UserPersonalizedDigestSendType.weekly,
            });
        }),
      );

    const timestamp = Date.now();

    await schedulePersonalizedDigestSubscriptions({
      queryBuilder: personalizedDigestQuery,
      logger,
      handler: async ({ personalizedDigest, emailBatchId }) => {
        const emailSendTimestamp = getPersonalizedDigestSendDate({
          personalizedDigest,
          generationTimestamp: timestamp,
        }).getTime();
        const previousSendTimestamp = getPersonalizedDigestPreviousSendDate({
          personalizedDigest,
          generationTimestamp: timestamp,
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
