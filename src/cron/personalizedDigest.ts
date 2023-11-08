import fastq from 'fastq';
import { UserPersonalizedDigest } from '../entity/UserPersonalizedDigest';
import { Cron } from './cron';

const cron: Cron = {
  name: 'personalized-digest',
  handler: async (con, logger) => {
    // const nextPreferredDay = (new Date().getDay() + 1) % 7;
    const personalizedDigestQuery = con
      .createQueryBuilder()
      .from(UserPersonalizedDigest, 'upd');
    // const timestamp = Date.now();
    let digestCount = 0;

    const personalizedDigestStream = await personalizedDigestQuery.stream();
    const notifyQueueConcurrency = 10;
    const notifyQueue = fastq.promise(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));

      digestCount += 1;
    }, notifyQueueConcurrency);

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

    logger.info({ digestCount }, 'personalized digest sent');
  },
};

export default cron;
