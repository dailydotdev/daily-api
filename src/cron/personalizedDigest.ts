import fastq from 'fastq';
import {
  createEmailBatchId,
  getPersonalizedDigestPreviousSendDate,
  getPersonalizedDigestSendDate,
  notifyGeneratePersonalizedDigest,
} from '../common';
import {
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
} from '../entity';
import { Cron } from './cron';
import { Brackets } from 'typeorm';

const cron: Cron = {
  name: 'personalized-digest',
  handler: async (con, logger) => {
    const emailBatchId = await createEmailBatchId();

    if (!emailBatchId) {
      throw new Error('failed to create email batch id');
    }

    logger.info({ emailBatchId }, 'starting personalized digest send');

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
    let digestCount = 0;

    const personalizedDigestStream = await personalizedDigestQuery.stream();
    const notifyQueueConcurrency = +process.env.DIGEST_QUEUE_CONCURRENCY;
    const notifyQueue = fastq.promise(
      async (personalizedDigest: UserPersonalizedDigest) => {
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

        digestCount += 1;
      },
      notifyQueueConcurrency,
    );

    personalizedDigestStream.on(
      'data',
      (personalizedDigest: UserPersonalizedDigest) => {
        notifyQueue.push(personalizedDigest);
      },
    );

    await new Promise((resolve, reject) => {
      personalizedDigestStream.on('error', (error) => {
        logger.error(
          { err: error, emailBatchId },
          'streaming personalized digest subscriptions failed',
        );

        reject(error);
      });
      personalizedDigestStream.on('end', resolve);
    });
    await notifyQueue.drained();

    logger.info({ digestCount, emailBatchId }, 'personalized digest sent');
  },
};

export default cron;
