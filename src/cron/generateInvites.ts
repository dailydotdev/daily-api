import fastq from 'fastq';
import { Cron } from './cron';
import { Feature, FeatureValue, Invite } from '../entity';
import { generateUUID } from '../ids';

const cron: Cron = {
  name: 'generate-invites',
  handler: async (con, logger) => {
    const featuresQuery = con
      .createQueryBuilder()
      .from(Feature, 'f')
      .where(
        'f."createdAt" < now() - interval \'7 days\' AND f."value" = :value',
        { value: FeatureValue.Allow },
      ).andWhere(`
        NOT EXISTS (
          SELECT  1
          FROM    invite i
          WHERE   i."userId" = f."userId"
          AND     i."campaign" = f."feature"
        )
      `);

    let count = 0;
    const queueConcurrency = 1000;
    const queue = fastq.promise(async ({ feature, userId }: Feature) => {
      await con.getRepository(Invite).insert({
        token: generateUUID(),
        campaign: feature,
        userId,
      });

      count += 1;
    }, queueConcurrency);

    const featuresStream = await featuresQuery.stream();
    featuresStream.on('data', (feature: Feature) => {
      queue.push(feature);
    });

    await new Promise((resolve, reject) => {
      featuresStream.on('error', (error) => {
        logger.error({ err: error }, 'streaming features failed');
        reject(error);
      });

      featuresStream.on('end', resolve);
    });
    await queue.drained();

    logger.info({ count }, 'invites generated');
  },
};

export default cron;
