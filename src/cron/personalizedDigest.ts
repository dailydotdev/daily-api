import fastq from 'fastq';
import {
  createEmailBatchId,
  notifyGeneratePersonalizedDigest,
} from '../common';
import { UserPersonalizedDigest } from '../entity/UserPersonalizedDigest';
import { Cron } from './cron';

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
      });
    const timestamp = Date.now();
    let digestCount = 0;

    const personalizedDigestStream = await personalizedDigestQuery.stream();
    const notifyQueueConcurrency = +process.env.DIGEST_QUEUE_CONCURRENCY;
    const notifyQueue = fastq.promise(
      async (personalizedDigest: UserPersonalizedDigest) => {
        await notifyGeneratePersonalizedDigest(
          logger,
          personalizedDigest,
          timestamp,
          emailBatchId,
        );

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
