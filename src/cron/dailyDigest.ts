import fastq from 'fastq';
import {
  createEmailBatchId,
  digestPreferredHourOffset,
  getPersonalizedDigestPreviousSendDate,
  getPersonalizedDigestSendDate,
  notifyGeneratePersonalizedDigest,
} from '../common';
import {
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
} from '../entity';
import { Cron } from './cron';

const cron: Cron = {
  name: 'daily-digest',
  handler: async (con, logger) => {
    const emailBatchId = await createEmailBatchId();
    const sendType = UserPersonalizedDigestSendType.workdays;

    if (!emailBatchId) {
      throw new Error('failed to create email batch id');
    }

    logger.info(
      { emailBatchId, sendType },
      'starting personalized digest send',
    );

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
          { err: error, emailBatchId, sendType },
          'streaming personalized digest subscriptions failed',
        );

        reject(error);
      });
      personalizedDigestStream.on('end', resolve);
    });
    await notifyQueue.drained();

    logger.info(
      { digestCount, emailBatchId, sendType },
      'personalized digest sent',
    );
  },
};

export default cron;
