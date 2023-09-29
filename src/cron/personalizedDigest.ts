import { notifyGeneratePersonalizedDigest } from '../common';
import { UserPersonalizedDigest } from '../entity/UserPersonalizedDigest';
import { Cron } from './cron';

const cron: Cron = {
  name: 'personalized-digest',
  handler: async (con, logger) => {
    const personalizedDigestQuery = con
      .createQueryBuilder()
      .from(UserPersonalizedDigest, 'upd');

    const personalizedDigestStream = await personalizedDigestQuery.stream();

    personalizedDigestStream.on(
      'data',
      (personalizedDigest: UserPersonalizedDigest) => {
        notifyGeneratePersonalizedDigest(logger, personalizedDigest);
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
  },
};

export default cron;
