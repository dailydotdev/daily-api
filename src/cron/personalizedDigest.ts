import fastq from 'fastq';
import { notifyGeneratePersonalizedDigest } from '../common';
import { UserPersonalizedDigest } from '../entity/UserPersonalizedDigest';
import { Cron } from './cron';

const cron: Cron = {
  name: 'personalized-digest',
  handler: async (con, logger) => {
    const nextPreferredDay = (new Date().getDay() + 1) % 7;
    const personalizedDigestQuery = con
      .createQueryBuilder()
      .from(UserPersonalizedDigest, 'upd')
      .where('upd."preferredDay" = :nextPreferredDay', {
        nextPreferredDay,
      });

    const personalizedDigestStream = await personalizedDigestQuery.stream();
    const notifyQueueConcurrency = 1000;
    const notifyQueue = fastq.promise(
      async (personalizedDigest: UserPersonalizedDigest) => {
        await notifyGeneratePersonalizedDigest(logger, personalizedDigest);
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
          { err: error },
          'streaming personalized digest subscriptions failed',
        );

        reject(error);
      });
      personalizedDigestStream.on('end', resolve);
    });
    await notifyQueue.drained();
  },
};

export default cron;
