import * as fastq from 'fastq';
import '../src/config';
import createOrGetConnection from '../src/db';
import { UserExperience } from '../src/entity/user/experiences/UserExperience';
import { UserExperienceType } from '../src/entity/user/experiences/types';
import { Company } from '../src/entity/Company';
import {
  enrichCompanyForExperience,
  EnrichmentLogger,
} from '../src/common/companyEnrichment';
import { DataSource } from 'typeorm';

const QUEUE_CONCURRENCY = 1;

interface ExperienceData {
  id: string;
  customCompanyName: string;
  type: string;
}

async function findExactCompanyMatch(
  con: DataSource,
  customCompanyName: string,
): Promise<Company | null> {
  return con
    .getRepository(Company)
    .createQueryBuilder('company')
    .where('LOWER(company.name) = LOWER(:name)', { name: customCompanyName })
    .orWhere('LOWER(company.altName) = LOWER(:name)', {
      name: customCompanyName,
    })
    .getOne();
}

const silentLogger: EnrichmentLogger = {
  info: () => {},
  warn: () => {},
  debug: () => {},
};

(async (): Promise<void> => {
  const limitArgument = process.argv[2];
  const offsetArgument = process.argv[3];

  if (!limitArgument || !offsetArgument) {
    throw new Error('limit and offset arguments are required');
  }

  const limit = +limitArgument;
  if (Number.isNaN(limit)) {
    throw new Error('limit argument is invalid, it should be a number');
  }

  const offset = +offsetArgument;
  if (Number.isNaN(offset)) {
    throw new Error('offset argument is invalid, it should be a number');
  }

  const con = await createOrGetConnection();

  console.log(
    `Processing experiences starting from offset ${offset} (limit ${limit})...`,
  );

  let enriched = 0;
  let exactMatches = 0;
  let processedCount = 0;

  const builder = con
    .getRepository(UserExperience)
    .createQueryBuilder('ue')
    .select('ue.id', 'id')
    .addSelect('ue.customCompanyName', 'customCompanyName')
    .addSelect('ue.type', 'type')
    .where('ue.type IN (:...types)', {
      types: [UserExperienceType.Work, UserExperienceType.Education],
    })
    .andWhere('ue.customCompanyName IS NOT NULL')
    .andWhere('ue.companyId IS NULL')
    .orderBy('ue.createdAt', 'ASC')
    .limit(limit)
    .offset(offset);

  const stream = await builder.stream();

  const enrichQueue = fastq.promise(async (experience: ExperienceData) => {
    // First check for exact name match to avoid API calls
    const exactMatch = await findExactCompanyMatch(
      con,
      experience.customCompanyName,
    );

    if (exactMatch) {
      await con
        .getRepository(UserExperience)
        .update({ id: experience.id }, { companyId: exactMatch.id });

      processedCount++;
      exactMatches++;
      return;
    }

    // No exact match, use enrichment API
    const result = await enrichCompanyForExperience(
      con,
      {
        experienceId: experience.id,
        customCompanyName: experience.customCompanyName,
        experienceType: experience.type as UserExperienceType,
      },
      silentLogger,
    );

    processedCount++;

    if (result.success) {
      enriched++;
    }
  }, QUEUE_CONCURRENCY);

  stream.on('data', (experience: ExperienceData) => {
    enrichQueue.push(experience);
  });

  await new Promise((resolve, reject) => {
    stream.on('error', reject);
    stream.on('end', () => resolve(true));
  });
  await enrichQueue.drained();

  console.log(
    `Completed. Processed ${processedCount} experiences: ${exactMatches} exact matches, ${enriched} enriched (offset ${offset} to ${offset + processedCount - 1}).`,
  );
  console.log(
    `Next batch command: npx ts-node bin/enrichExistingCompanies.ts ${limit} ${offset + limit}`,
  );

  process.exit(0);
})().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
