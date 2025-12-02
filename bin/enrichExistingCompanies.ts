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
const LOG_INTERVAL = 100; // Log progress every N items

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
  let failed = 0;
  const startTime = Date.now();

  const logProgress = () => {
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = processedCount / elapsed;
    console.log(
      `[Progress] ${processedCount} processed | ${exactMatches} exact | ${enriched} enriched | ${failed} failed | ${rate.toFixed(1)}/sec`,
    );
  };

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

      if (processedCount % LOG_INTERVAL === 0) {
        logProgress();
      }
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
    } else {
      failed++;
    }

    if (processedCount % LOG_INTERVAL === 0) {
      logProgress();
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

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `Completed in ${totalTime}s. Processed ${processedCount} experiences: ${exactMatches} exact matches, ${enriched} enriched, ${failed} failed (offset ${offset} to ${offset + processedCount - 1}).`,
  );
  console.log(
    `Next batch command: npx ts-node bin/enrichExistingCompanies.ts ${limit} ${offset + limit}`,
  );

  process.exit(0);
})().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
