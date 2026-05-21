import fetch from 'node-fetch';
import { ArrayContains, IsNull } from 'typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import { anthropicClient } from '../integrations/anthropic';
import { generateShortId } from '../ids';
import { Company, CompanyType } from '../entity/Company';
import { UserExperience } from '../entity/user/experiences/UserExperience';
import { UserExperienceType } from '../entity/user/experiences/types';
import { UserCompany } from '../entity/UserCompany';
import { validateWorkEmailDomain } from './utils';

const GOOGLE_FAVICON_URL = 'https://www.google.com/s2/favicons';
const FAVICON_SIZE = 128;
const DOMAIN_CHECK_TIMEOUT = 10000;
const DOMAIN_CHECK_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export type EnrichmentLogger = {
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

        logger.debug(
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

export function getGoogleFaviconUrl(domain: string): string {
  return `${GOOGLE_FAVICON_URL}?domain=${encodeURIComponent(domain)}&sz=${FAVICON_SIZE}`;
}

export type EnrichCompanyParams = {
  experienceId: string;
  customCompanyName: string;
  experienceType: UserExperienceType;
};

export type EnrichCompanyForUserCompanyParams = {
  userCompanyEmail: string;
  userCompanyUserId: string;
  domain: string;
};

type RepositorySource = DataSource | EntityManager;

type OrganizationInfo = {
  englishName?: string;
  nativeName?: string;
  domain?: string;
};

type CreateCompanyParams = {
  domain: string;
  englishName: string;
  nativeName?: string;
  type: CompanyType;
};

const skippedResult = (error: string): EnrichmentResult => ({
  success: false,
  skipped: true,
  linkedToExisting: false,
  companyCreated: false,
  error,
});

const linkedResult = (companyId: string): EnrichmentResult => ({
  success: true,
  skipped: false,
  linkedToExisting: true,
  companyCreated: false,
  companyId,
});

const createdResult = (companyId: string): EnrichmentResult => ({
  success: true,
  skipped: false,
  linkedToExisting: false,
  companyCreated: true,
  companyId,
});

const isAnthropicConfigured = (): boolean =>
  !!anthropicClient && !!process.env.ANTHROPIC_API_KEY;

const getCompanyByDomain = (
  source: RepositorySource,
  domain: string,
): Promise<Company | null> =>
  source.getRepository(Company).findOneBy({
    domains: ArrayContains([domain]),
  });

const createCompany = async (
  source: RepositorySource,
  { domain, englishName, nativeName, type }: CreateCompanyParams,
): Promise<string> => {
  const companyId = await generateShortId();
  const altName = nativeName && nativeName !== englishName ? nativeName : null;
  const company = source.getRepository(Company).create({
    id: companyId,
    name: englishName,
    altName,
    image: getGoogleFaviconUrl(domain),
    domains: [domain],
    type,
  });

  await source.getRepository(Company).save(company);

  return companyId;
};

const getOrganizationInfo = async ({
  input,
  includeDomain,
}: {
  input: string;
  includeDomain: boolean;
}): Promise<OrganizationInfo> => {
  const properties = {
    englishName: {
      type: 'string',
      description: 'The English name of the organization',
    },
    nativeName: {
      type: 'string',
      description: 'The name of the organization in its native language',
    },
    ...(includeDomain
      ? {
          domain: {
            type: 'string',
            description:
              'The web domain of the organization. Return empty string if unknown.',
          },
        }
      : {}),
  };

  const res = await anthropicClient.createMessage({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system: includeDomain
      ? 'You are a helpful assistant that returns information about an organization. The user will give you a name, and you will return its name in both English and its native language, as well as their web domain. If you cannot find the domain, return an empty string.'
      : 'You are a helpful assistant that returns information about an organization. The user will give you a web domain, and you will return the organization name in both English and its native language.',
    messages: [
      {
        role: 'user',
        content: input,
      },
    ],
    tools: [
      {
        name: 'organization_info',
        description: includeDomain
          ? 'Gets information about the given organization'
          : 'Gets information about the organization for a domain',
        input_schema: {
          type: 'object',
          properties,
          required: includeDomain
            ? ['englishName', 'nativeName', 'domain']
            : ['englishName', 'nativeName'],
        },
      },
    ],
    tool_choice: {
      type: 'tool',
      name: 'organization_info',
    },
  });

  return (res.content[0]?.input ?? {}) as OrganizationInfo;
};

const getUserCompanyResult = async (
  manager: EntityManager,
  { userCompanyEmail, userCompanyUserId }: EnrichCompanyForUserCompanyParams,
): Promise<EnrichmentResult | null> => {
  const userCompany = await manager.getRepository(UserCompany).findOneBy({
    email: userCompanyEmail,
    userId: userCompanyUserId,
  });

  if (!userCompany) {
    return skippedResult('User company not found');
  }

  return userCompany.companyId ? linkedResult(userCompany.companyId) : null;
};

const updateUserCompanyCompanyId = (
  manager: EntityManager,
  { userCompanyEmail, userCompanyUserId }: EnrichCompanyForUserCompanyParams,
  companyId: string,
) =>
  manager.getRepository(UserCompany).update(
    {
      email: userCompanyEmail,
      userId: userCompanyUserId,
      companyId: IsNull(),
    },
    { companyId },
  );

const linkExistingCompanyForUserCompany = async (
  con: DataSource,
  params: EnrichCompanyForUserCompanyParams,
): Promise<EnrichmentResult | null> =>
  con.transaction(async (manager) => {
    const existingUserCompanyResult = await getUserCompanyResult(
      manager,
      params,
    );
    if (existingUserCompanyResult) {
      return existingUserCompanyResult;
    }

    const existingCompany = await getCompanyByDomain(manager, params.domain);
    if (!existingCompany) {
      return null;
    }

    await updateUserCompanyCompanyId(manager, params, existingCompany.id);

    return linkedResult(existingCompany.id);
  });

export async function enrichCompanyForUserCompany(
  con: DataSource,
  params: EnrichCompanyForUserCompanyParams,
  logger: EnrichmentLogger,
): Promise<EnrichmentResult> {
  const domain = params.domain.trim().toLowerCase();
  const userCompanyParams = { ...params, domain };

  if (!domain) {
    return skippedResult('Missing domain');
  }

  if (validateWorkEmailDomain(domain)) {
    logger.debug({ domain }, 'Work email domain is ignored, skipping');
    return skippedResult('Ignored work email domain');
  }

  const existingResult = await linkExistingCompanyForUserCompany(
    con,
    userCompanyParams,
  );
  if (existingResult) {
    return existingResult;
  }

  if (!isAnthropicConfigured()) {
    logger.debug({}, 'Anthropic client not configured, skipping enrichment');
    return skippedResult('Anthropic client not configured');
  }

  const { englishName, nativeName } = await getOrganizationInfo({
    input: domain,
    includeDomain: false,
  });

  if (!englishName) {
    logger.debug({ domain }, 'Missing required organization info englishName');
    return skippedResult('Missing englishName');
  }

  const validatedDomain = await validateDomain(domain, logger);
  if (!validatedDomain) {
    logger.debug({ domain }, 'Domain validation failed, using email domain');
  }

  return con.transaction(async (manager) => {
    const existingUserCompanyResult = await getUserCompanyResult(
      manager,
      userCompanyParams,
    );
    if (existingUserCompanyResult) {
      return existingUserCompanyResult;
    }

    const existingCompany = await getCompanyByDomain(manager, domain);
    if (existingCompany) {
      await updateUserCompanyCompanyId(
        manager,
        userCompanyParams,
        existingCompany.id,
      );

      return linkedResult(existingCompany.id);
    }

    const companyId = await createCompany(manager, {
      domain,
      englishName,
      nativeName,
      type: CompanyType.Company,
    });

    await updateUserCompanyCompanyId(manager, userCompanyParams, companyId);

    return createdResult(companyId);
  });
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

  if (!isAnthropicConfigured()) {
    logger.debug({}, 'Anthropic client not configured, skipping enrichment');
    return skippedResult('Anthropic client not configured');
  }

  const { englishName, nativeName, domain } = await getOrganizationInfo({
    input: customCompanyName,
    includeDomain: true,
  });

  if (!englishName || !domain) {
    logger.debug(
      { englishName, domain },
      'Missing required organization info (englishName or domain)',
    );
    return skippedResult('Missing englishName or domain');
  }

  const validatedDomain = await validateDomain(domain, logger);
  if (!validatedDomain) {
    logger.debug({ domain }, 'Domain validation failed');
    return skippedResult(`Domain validation failed for ${domain}`);
  }

  const existingCompany = await getCompanyByDomain(con, validatedDomain);

  if (existingCompany) {
    await con
      .getRepository(UserExperience)
      .update({ id: experienceId }, { companyId: existingCompany.id });

    return linkedResult(existingCompany.id);
  }

  const companyId = await createCompany(con, {
    domain: validatedDomain,
    englishName,
    nativeName,
    type:
      experienceType === UserExperienceType.Education
        ? CompanyType.School
        : CompanyType.Company,
  });

  await con
    .getRepository(UserExperience)
    .update({ id: experienceId }, { companyId });

  return createdResult(companyId);
}
