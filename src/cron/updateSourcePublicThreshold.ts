import { Cron } from './cron';
import {
  REPUTATION_THRESHOLD,
  Source,
  SQUAD_IMAGE_PLACEHOLDER,
} from '../entity';
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
          "image" != '${SQUAD_IMAGE_PLACEHOLDER}' AND
          "description" IS NOT NULL AND
          (flags->>'publicThreshold')::boolean IS NOT TRUE AND
          (flags->>'vordr')::boolean IS NOT TRUE AND
          (
          ((flags->>'totalMembers')::int >= 3 AND (flags->>'totalPosts')::int >= 3) OR
          exists (select 1
            from "content_preference" cp
            join "user" u on cp."userId" = u.id
            where cp."referenceId" = "source".id and cp.type = 'source'
                and cp.flags->>'role' = 'admin' and u.reputation >= :threshold
                and (u.flags->>'vordr')::boolean IS NOT TRUE
          ))
      `,
        { threshold: REPUTATION_THRESHOLD },
      )
      .execute();
    logger.info(
      { count: result.affected },
      'public threshold updated for valid sources! 🚀',
    );
  },
};
