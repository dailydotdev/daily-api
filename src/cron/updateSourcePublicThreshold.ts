import { Cron } from './cron';
import {
  REPUTATION_THRESHOLD,
  Source,
  SourceType,
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
        /* sql */ `
          "type" = :squadSourceType AND
          "image" IS NOT NULL AND
          "image" != :imagePlaceholder AND
          "description" IS NOT NULL AND
          (flags->>'publicThreshold')::boolean IS NOT TRUE AND
          (flags->>'vordr')::boolean IS NOT TRUE AND
          (
            (
              (flags->>'totalMembers')::int >= 3 AND (flags->>'totalPosts')::int >= 3
            ) OR
            EXISTS (SELECT 1
              FROM "content_preference" cp
              JOIN "user" u ON cp."userId" = u.id
              WHERE cp."referenceId" = "source".id AND cp.type = 'source'
                  AND cp.flags->>'role' = 'admin' AND u.reputation >= :threshold
                  AND (u.flags->>'vordr')::boolean IS NOT TRUE
            )
          )
      `,
        {
          imagePlaceholder: SQUAD_IMAGE_PLACEHOLDER,
          threshold: REPUTATION_THRESHOLD,
          squadSourceType: SourceType.Squad,
        },
      )
      .execute();
    logger.info(
      { count: result.affected },
      'public threshold updated for valid sources! 🚀',
    );
  },
};
