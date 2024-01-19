import { Cron } from './cron';
import { FeatureType, FeatureValue } from '../entity';

const cron: Cron = {
  name: 'generate-search-invites',
  handler: async (con, logger) => {
    await con.query(
      `
      INSERT INTO invite (campaign, "userId")
      SELECT  f.feature,
              f."userId"
      FROM    feature f
      WHERE   f."createdAt" < now() - interval '1 days'
        AND   f."value" = $1
        AND   f."feature" = $2
        AND NOT EXISTS (
          SELECT  1
          FROM    invite i
          WHERE   i."userId" = f."userId"
            AND   i.campaign = f.feature
        );
    `,
      [FeatureValue.Allow, FeatureType.Search],
    );

    logger.info('invites generated');
  },
};

export default cron;
