import '../src/config';
import createOrGetConnection from '../src/db';
import { UserExperience } from '../src/entity/user/experiences/UserExperience';
import { UserExperienceType } from '../src/entity/user/experiences/types';
import {
  enrichCompanyForExperience,
  EnrichmentLogger,
} from '../src/common/companyEnrichment';

const silentLogger: EnrichmentLogger = {
  info: () => {},
  warn: () => {},
  debug: () => {},
};

(async (): Promise<void> => {
  const con = await createOrGetConnection();

  const experiences = await con
    .getRepository(UserExperience)
    .createQueryBuilder('ue')
    .where('ue.type IN (:...types)', {
      types: [UserExperienceType.Work, UserExperienceType.Education],
    })
    .andWhere('ue.customCompanyName IS NOT NULL')
    .andWhere('ue.companyId IS NULL')
    .orderBy('ue.createdAt', 'ASC')
    .getMany();

  console.log(`Fetched: ${experiences.length}`);

  let enriched = 0;

  for (const experience of experiences) {
    const result = await enrichCompanyForExperience(
      con,
      {
        experienceId: experience.id,
        customCompanyName: experience.customCompanyName!,
        experienceType: experience.type as UserExperienceType,
      },
      silentLogger,
    );

    if (result.success) {
      enriched++;
    }
  }

  console.log(`Enriched: ${enriched}`);

  process.exit(0);
})().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
