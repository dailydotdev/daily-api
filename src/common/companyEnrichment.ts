import fetch from 'node-fetch';
import { ArrayOverlap, IsNull } from 'typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import { getBragiClient } from '../integrations/bragi';
import { generateShortId } from '../ids';
import { Company, CompanyType } from '../entity/Company';
import { UserExperience } from '../entity/user/experiences/UserExperience';
import { UserExperienceWork } from '../entity/user/experiences/UserExperienceWork';
import { UserExperienceType } from '../entity/user/experiences/types';
import { UserCompany } from '../entity/UserCompany';
import { validateWorkEmailDomain } from './utils';

// Self-employment and placeholder answers people type into the company field.
// They can never resolve to an organization, so they skip the LLM round trip.
// Matched on the exact normalized string, never as a prefix: "freelancer.com"
// and "Independent University, Bangladesh" are real organizations.
const NON_ORGANIZATION_NAMES = new Set([
  'confidential',
  'freelance',
  'freelance / contract',
  'freelance / personal projects',
  'freelance / self employed',
  'freelance developer',
  'freelance projects',
  'freelance self employed',
  'freelance web developer',
  'freelancer',
  'freelancing',
  'home',
  'independent consultant',
  'independent contractor',
  'independent projects',
  'multiple companies',
  'myself',
  'n/a',
  'na',
  'none',
  'own business',
  'personal',
  'personal project',
  'personal projects',
  'self employed',
  'self employed / freelance',
  'side project',
  'side projects',
  'student',
  'unemployed',
  'various',
  'various clients',
  'various companies',
]);

// Collapses the punctuation people use to join these phrases ("freelance |
// self-employed", "Freelance/Self Employed") so one entry covers the variants.
export const isNonOrganizationName = (name: string): boolean =>
  NON_ORGANIZATION_NAMES.has(
    name
      .toLowerCase()
      .replace(/[|,()]/g, ' ')
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );

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

// A TLS handshake that produced a certificate proves the host resolves and serves
// HTTPS, which is all this check asks. Chains we cannot verify (missing
// intermediates, expired or self-signed certs) are common on university and
// government sites and say nothing about whether the organization is real.
function isCertificateError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('certificate') || message.includes('cert');
}

export const getDomainVariants = (domain: string): string[] =>
  domain.startsWith('www.')
    ? [domain, domain.slice(4)]
    : [domain, `www.${domain}`];

async function validateDomain(
  domain: string,
  logger: EnrichmentLogger,
): Promise<string | null> {
  // Try the LLM-provided domain first, then the opposite variant
  for (const testDomain of getDomainVariants(domain)) {
    for (let attempt = 1; attempt <= DOMAIN_CHECK_RETRIES; attempt++) {
      try {
        const isValid = await tryFetchDomain(testDomain, logger);
        if (isValid) {
          return testDomain;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (isCertificateError(error)) {
          logger.debug(
            { testDomain, errorMessage },
            'Domain served an unverifiable certificate, treating as reachable',
          );

          return testDomain;
        }

        logger.debug(
          {
            testDomain,
            attempt,
            maxAttempts: DOMAIN_CHECK_RETRIES,
            errorMessage,
          },
          'Domain validation attempt failed',
        );

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
  customDomain?: string | null;
};

export type EnrichCompanyForUserCompanyParams = {
  userCompanyEmail: string;
  userCompanyUserId: string;
  domain: string;
};

type RepositorySource = DataSource | EntityManager;

type OrganizationInfo = {
  englishName: string;
  nativeName: string;
  domain: string;
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

const getCompanyByDomain = (
  source: RepositorySource,
  domain: string,
): Promise<Company | null> =>
  source.getRepository(Company).findOneBy({
    domains: ArrayOverlap(getDomainVariants(domain)),
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

const getOrganizationInfo = async (
  input: { name: string } | { domain: string },
): Promise<OrganizationInfo> => {
  const bragiClient = getBragiClient();
  const { englishName, nativeName, domain } = await bragiClient.garmr.execute(
    () =>
      bragiClient.instance.resolveOrganization(
        'name' in input
          ? { input: { case: 'name', value: input.name } }
          : { input: { case: 'domain', value: input.domain } },
      ),
  );

  return { englishName, nativeName, domain };
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

  const { englishName, nativeName } = await getOrganizationInfo({ domain });

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

const linkExperienceToCompany = (
  con: DataSource,
  experienceId: string,
  companyId: string,
) =>
  con.getRepository(UserExperience).update({ id: experienceId }, { companyId });

/**
 * Marks the user's Work experiences at a company verified, mirroring a verified
 * UserCompany record.
 *
 * Enrichment resolves a UserCompany's companyId asynchronously, so it commonly
 * lands after the user has already entered their verification code. The
 * mutation that flips `verified` has a null companyId at that point and CDC
 * only reacts to a verified transition, so without this nothing ever revisits
 * the experience.
 */
export const syncVerifiedUserWorkExperiences = async (
  con: RepositorySource,
  userId: string,
  companyId: string | null,
): Promise<void> => {
  if (!companyId) {
    return;
  }

  // Callers include the enrichment worker, which runs for unverified records
  // too - it fires when the email is added, before any code is entered.
  const isVerified = await con
    .getRepository(UserCompany)
    .existsBy({ userId, companyId, verified: true });

  if (!isVerified) {
    return;
  }

  await con
    .getRepository(UserExperienceWork)
    .update({ userId, companyId, verified: false }, { verified: true });
};

/**
 * Enriches a company for a given user experience.
 * Resolves the organization through bragi, validates the domain,
 * and either links to an existing company or creates a new one.
 */
export async function enrichCompanyForExperience(
  con: DataSource,
  params: EnrichCompanyParams,
  logger: EnrichmentLogger,
): Promise<EnrichmentResult> {
  const { experienceId, customCompanyName, experienceType, customDomain } =
    params;

  if (isNonOrganizationName(customCompanyName)) {
    logger.debug({ customCompanyName }, 'Not an organization, skipping');
    return skippedResult('Not an organization');
  }

  // The user typed this domain themselves, so it beats asking a model to guess
  // one from the name. Only ever used to link an existing company - creating
  // from unvalidated user input would let a typo mint a company row.
  if (customDomain) {
    const companyByCustomDomain = await getCompanyByDomain(con, customDomain);

    if (companyByCustomDomain) {
      await linkExperienceToCompany(
        con,
        experienceId,
        companyByCustomDomain.id,
      );

      return linkedResult(companyByCustomDomain.id);
    }
  }

  const { englishName, nativeName, domain } = await getOrganizationInfo({
    name: customCompanyName,
  });

  if (!englishName || !domain) {
    logger.debug(
      { englishName, domain },
      'Missing required organization info (englishName or domain)',
    );
    return skippedResult('Missing englishName or domain');
  }

  // A domain we already store needs no liveness check - sites behind a WAF
  // answer 403 to this fetch, which would otherwise strand the experience even
  // though the company is right there.
  const existingCompany = await getCompanyByDomain(con, domain);

  if (existingCompany) {
    await linkExperienceToCompany(con, experienceId, existingCompany.id);

    return linkedResult(existingCompany.id);
  }

  const validatedDomain = await validateDomain(domain, logger);
  if (!validatedDomain) {
    logger.debug({ domain }, 'Domain validation failed');
    return skippedResult(`Domain validation failed for ${domain}`);
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

  await linkExperienceToCompany(con, experienceId, companyId);

  return createdResult(companyId);
}
