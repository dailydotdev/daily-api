import { Cron } from './cron';
import { Source } from '../entity';
import { updateFlagsStatement } from '../common';

export const updateSourcePublicThreshold: Cron = {
  name: 'update-source-public-threshold',
  handler: async (con, logger) => {
    logger.info('updating public threshold value for valid sources...');
    const result = await con
      .getRepository(Source)
      .createQueryBuilder('s')
      .update()
      .set({ flags: updateFlagsStatement({ publicThreshold: true }) })
      .where(
        `
          "type" = 'squad' AND
          "image" IS NOT NULL AND
          "description" IS NOT NULL AND
          (flags->>'totalMembers')::int >= 3 AND
          (flags->>'totalPosts')::int >= 3 AND
          (flags->>'publicThreshold')::boolean IS NOT TRUE
      `,
      )
      .execute();
    logger.info(
      { count: result.affected },
      'public threshold updated for valid sources! 🚀',
    );
  },
};
