import { In } from 'typeorm';
import type { DataSource } from 'typeorm';
import { Cron } from './cron';
import { Company } from '../entity/Company';
import { UserExperience } from '../entity/user/experiences/UserExperience';
import { UserExperienceType } from '../entity/user/experiences/types';
import { isNonOrganizationName } from '../common/companyEnrichment';

const BATCH_SIZE = 1000;

type Candidate = { experienceId: string; companyId: string; name: string };

// Walks by id rather than plain limit/offset: rows we deliberately skip stay
// unlinked, so a fixed window would keep handing back the same ones forever.
const findCandidates = (con: DataSource, cursor: string) =>
  con
    .createQueryBuilder()
    .select('ue.id', 'experienceId')
    // A name can belong to more than one company; min() keeps the pick
    // deterministic across reruns.
    .addSelect('min(c.id)', 'companyId')
    .addSelect('min(ue."customCompanyName")', 'name')
    .from(UserExperience, 'ue')
    .innerJoin(
      Company,
      'c',
      'lower(c.name) = lower(btrim(ue."customCompanyName"))',
    )
    .where('ue."companyId" IS NULL')
    .andWhere('ue."customCompanyName" IS NOT NULL')
    .andWhere('ue.type IN (:...types)', {
      types: [UserExperienceType.Work, UserExperienceType.Education],
    })
    .andWhere('ue.id > :cursor', { cursor })
    .groupBy('ue.id')
    .orderBy('ue.id')
    .limit(BATCH_SIZE)
    .getRawMany<Candidate>();

const cron: Cron = {
  name: 'backfill-experience-company',
  handler: async (con, logger) => {
    let cursor = '00000000-0000-0000-0000-000000000000';
    let linked = 0;
    let skipped = 0;

    for (;;) {
      const candidates = await findCandidates(con, cursor);

      if (!candidates.length) {
        break;
      }

      cursor = candidates[candidates.length - 1].experienceId;

      // "Freelance" and "Self-Employed" exist as company rows, so an exact name
      // match would attach every self-employed person to them.
      const linkable = candidates.filter(
        ({ name }) => !isNonOrganizationName(name),
      );
      skipped += candidates.length - linkable.length;

      const byCompany = linkable.reduce<Map<string, string[]>>(
        (acc, { companyId, experienceId }) => {
          const ids = acc.get(companyId) ?? [];
          ids.push(experienceId);

          return acc.set(companyId, ids);
        },
        new Map(),
      );

      for (const [companyId, experienceIds] of byCompany) {
        await con
          .getRepository(UserExperience)
          .update({ id: In(experienceIds) }, { companyId });

        linked += experienceIds.length;
      }
    }

    logger.info({ linked, skipped }, 'experience companies backfilled');
  },
};

export default cron;
