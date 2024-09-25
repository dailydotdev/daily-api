import { JsonContains, MoreThan, Not } from 'typeorm';
import { Cron } from './cron';
import { Source } from '../entity';
import { updateFlagsStatement } from '../common';

export const updateSourcePublicThreshold: Cron = {
  name: 'update-source-public-threshold',
  handler: async (con, logger) => {
    logger.info('updating public threshold value for valid sources...');
    const result = await con.getRepository(Source).update(
      {
        flags: JsonContains({
          publicThreshold: Not(true),
          totalMembers: MoreThan(2),
          totalPosts: MoreThan(2),
        }),
      },
      { flags: updateFlagsStatement({ publicThreshold: true }) },
    );
    logger.info(
      { count: result.affected },
      'public threshold updated for valid sources! 🚀',
    );
  },
};
