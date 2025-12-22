import {
  EmploymentType,
  LocationType,
  SeniorityLevel,
} from '@dailydotdev/schema';
import type { OpportunityJob } from '../../entity/opportunities/OpportunityJob';
import { textFromEnumValue } from '../protobuf';

export const createOpportunityPrompt = async ({
  opportunity,
}: {
  opportunity: OpportunityJob;
}) => {
  const locations = await opportunity.locations;
  const firstLocation = locations?.[0];
  const locationData = firstLocation ? await firstLocation.location : null;

  const promptData = {
    locationType: textFromEnumValue(LocationType, firstLocation?.type),
    city: locationData?.city,
    subdivision: locationData?.subdivision,
    country: locationData?.country,
    jobType: textFromEnumValue(
      EmploymentType,
      opportunity.meta?.employmentType,
    ),
    seniorityLevel: textFromEnumValue(
      SeniorityLevel,
      opportunity.meta?.seniorityLevel,
    ),
    overview: opportunity.content?.overview?.content ?? opportunity.tldr,
    responsibilities: opportunity.content?.responsibilities?.content,
    requirements: opportunity.content?.requirements?.content,
    whatYoullDo: opportunity.content?.whatYoullDo?.content,
  };

  const locationRow = [
    promptData.locationType,
    promptData.city,
    promptData.subdivision,
    promptData.country,
  ]
    .filter(Boolean)
    .join(', ');

  const contentRows = Object.entries({
    Overview: promptData.overview,
    Responsibilities: promptData.responsibilities,
    Requirements: promptData.requirements,
    "What You'll Do": promptData.whatYoullDo,
  })
    .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    .map(([key, value]) => `### ${key} ###\n${value}`)
    .join('\n\n');

  const prompt = `**Location:** ${locationRow}
**Job Type:** ${promptData.jobType}
**Seniority Level:** ${promptData.seniorityLevel}

${contentRows}`;

  return prompt;
};
