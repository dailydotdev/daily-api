import {
  EmploymentType,
  LocationType,
  SeniorityLevel,
} from '@dailydotdev/schema';
import type { OpportunityJob } from '../../entity/opportunities/OpportunityJob';

const extractTextFromEnum = <T extends Record<string, unknown>>(
  enumObj: T,
  value: number | string | undefined,
  defaultValue = 'Not specified',
): string => {
  return (
    Object.entries(enumObj).find(([, enumValue]) => enumValue === value)?.[0] ??
    defaultValue
  );
};

export const createOpportunityPrompt = ({
  opportunity,
}: {
  opportunity: OpportunityJob;
}) => {
  const promptData = {
    locationType: extractTextFromEnum(
      LocationType,
      opportunity.location?.[0]?.type,
    ),
    city: opportunity.location?.[0]?.city,
    subdivision: opportunity.location?.[0]?.subdivision,
    country: opportunity.location?.[0]?.country,
    jobType: extractTextFromEnum(
      EmploymentType,
      opportunity.meta?.employmentType,
    ),
    seniorityLevel: extractTextFromEnum(
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
