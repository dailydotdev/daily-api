import fetch from 'node-fetch';
import { DataSource } from 'typeorm';
import { anthropicClient } from '../integrations/anthropic';
import { generateShortId } from '../ids';
import { Company, CompanyType } from '../entity/Company';
import { UserExperience } from '../entity/user/experiences/UserExperience';
import { UserExperienceType } from '../entity/user/experiences/types';

const GOOGLE_FAVICON_URL = 'https://www.google.com/s2/favicons';
const FAVICON_SIZE = 128;
const DOMAIN_CHECK_TIMEOUT = 10000;
const DOMAIN_CHECK_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export type EnrichmentLogger = {
  info: (obj: object, msg: string) => void;
  warn: (obj: object, msg: string) => void;
  debug: (obj: object, msg: string) => void;
};

export type EnrichmentResult = {
  success: boolean;
  skipped: boolean;
  linkedToExisting: boolean;
  companyCreated: boolean;
  companyId?: string;
  error?: string;
};

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryFetchDomain(
  testDomain: string,
  logger: EnrichmentLogger,
): Promise<boolean> {
  const response = await fetch(`https://${testDomain}`, {
    method: 'GET',
    timeout: DOMAIN_CHECK_TIMEOUT,
    redirect: 'follow',
  });

  logger.debug(
    { testDomain, status: response.status },
    'Domain check response',
  );

  return response.ok;
}

function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  // SSL/TLS certificate errors are not retryable - they're deterministic
  if (message.includes('certificate') || message.includes('cert')) {
    return false;
  }
  return true;
}

async function validateDomain(
  domain: string,
  logger: EnrichmentLogger,
): Promise<string | null> {
  // Try the LLM-provided domain first, then the opposite variant
  const domainsToTry = domain.startsWith('www.')
    ? [domain, domain.slice(4)]
    : [domain, `www.${domain}`];

  for (const testDomain of domainsToTry) {
    for (let attempt = 1; attempt <= DOMAIN_CHECK_RETRIES; attempt++) {
      try {
        const isValid = await tryFetchDomain(testDomain, logger);
        if (isValid) {
          return testDomain;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const retryable = isRetryableError(error);

        logger.warn(
          {
            testDomain,
            attempt,
            maxAttempts: DOMAIN_CHECK_RETRIES,
            errorMessage,
            retryable,
          },
          'Domain validation attempt failed',
        );

        if (!retryable) {
          break;
        }

        if (attempt < DOMAIN_CHECK_RETRIES) {
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }
  }

  return null;
}

function getGoogleFaviconUrl(domain: string): string {
  return `${GOOGLE_FAVICON_URL}?domain=${encodeURIComponent(domain)}&sz=${FAVICON_SIZE}`;
}

export interface EnrichCompanyParams {
  experienceId: string;
  customCompanyName: string;
  experienceType: UserExperienceType;
}

/**
 * Enriches a company for a given user experience.
 * Uses Claude AI to extract company info, validates the domain,
 * and either links to an existing company or creates a new one.
 */
export async function enrichCompanyForExperience(
  con: DataSource,
  params: EnrichCompanyParams,
  logger: EnrichmentLogger,
): Promise<EnrichmentResult> {
  const { experienceId, customCompanyName, experienceType } = params;

  if (!anthropicClient) {
    logger.warn({}, 'Anthropic client not configured, skipping enrichment');
    return {
      success: false,
      skipped: true,
      linkedToExisting: false,
      companyCreated: false,
      error: 'Anthropic client not configured',
    };
  }

  const res = await anthropicClient.createMessage({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system:
      'You are a helpful assistant that returns information about an organization. The user will give you a name, and you will return its name in both English and its native language, as well as their web domain. If you cannot find the domain, return an empty string.',
    messages: [
      {
        role: 'user',
        content: customCompanyName,
      },
    ],
    tools: [
      {
        name: 'organization_info',
        description: 'Gets information about the given organization',
        input_schema: {
          type: 'object',
          properties: {
            englishName: {
              type: 'string',
              description: 'The English name of the organization',
            },
            nativeName: {
              type: 'string',
              description:
                'The name of the organization in its native language',
            },
            domain: {
              type: 'string',
              description:
                'The web domain of the organization. Return empty string if unknown.',
            },
          },
          required: ['englishName', 'nativeName', 'domain'],
        },
      },
    ],
    tool_choice: {
      type: 'tool',
      name: 'organization_info',
    },
  });

  const { englishName, nativeName, domain } = res.content[0].input as {
    englishName: string;
    nativeName: string;
    domain: string;
  };

  logger.info(
    { englishName, nativeName, domain },
    'Extracted organization info',
  );

  if (!englishName || !domain) {
    logger.warn(
      {},
      'Missing required organization info (englishName or domain)',
    );
    return {
      success: false,
      skipped: true,
      linkedToExisting: false,
      companyCreated: false,
      error: 'Missing englishName or domain',
    };
  }

  const validatedDomain = await validateDomain(domain, logger);
  if (!validatedDomain) {
    logger.warn(
      {
        domain,
        timeout: DOMAIN_CHECK_TIMEOUT,
        retries: DOMAIN_CHECK_RETRIES,
      },
      'Domain validation failed after all retries',
    );
    return {
      success: false,
      skipped: true,
      linkedToExisting: false,
      companyCreated: false,
      error: `Domain validation failed for ${domain}`,
    };
  }

  logger.info({ validatedDomain }, 'Domain validated successfully');

  const existingCompany = await con
    .getRepository(Company)
    .createQueryBuilder('company')
    .where(':domain = ANY(company.domains)', { domain: validatedDomain })
    .getOne();

  if (existingCompany) {
    logger.info(
      { existingCompanyId: existingCompany.id, domain: validatedDomain },
      'Found existing company with domain',
    );

    await con
      .getRepository(UserExperience)
      .update({ id: experienceId }, { companyId: existingCompany.id });

    logger.info(
      { experienceId, companyId: existingCompany.id },
      'UserExperience linked to existing company',
    );
    return {
      success: true,
      skipped: false,
      linkedToExisting: true,
      companyCreated: false,
      companyId: existingCompany.id,
    };
  }

  const faviconUrl = getGoogleFaviconUrl(validatedDomain);
  const companyId = await generateShortId();
  const altName = nativeName && nativeName !== englishName ? nativeName : null;
  const companyType =
    experienceType === UserExperienceType.Education
      ? CompanyType.School
      : CompanyType.Company;
  const company = con.getRepository(Company).create({
    id: companyId,
    name: englishName,
    altName,
    image: faviconUrl,
    domains: [validatedDomain],
    type: companyType,
  });

  await con.getRepository(Company).save(company);
  logger.info(
    { companyId, name: englishName, type: companyType },
    'Company created',
  );

  await con
    .getRepository(UserExperience)
    .update({ id: experienceId }, { companyId });

  logger.info(
    { experienceId, companyId },
    'UserExperience updated with companyId',
  );

  return {
    success: true,
    skipped: false,
    linkedToExisting: false,
    companyCreated: true,
    companyId,
  };
}
