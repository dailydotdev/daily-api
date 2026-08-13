import nock from 'nock';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  enrichCompanyForExperience,
  enrichCompanyForUserCompany,
  getGoogleFaviconUrl,
  isNonOrganizationName,
} from '../../src/common/companyEnrichment';
import { Company, CompanyType } from '../../src/entity/Company';
import { UserCompany } from '../../src/entity/UserCompany';
import { User } from '../../src/entity/user/User';
import { UserExperience } from '../../src/entity/user/experiences/UserExperience';
import { UserExperienceWork } from '../../src/entity/user/experiences/UserExperienceWork';
import { UserExperienceType } from '../../src/entity/user/experiences/types';
import { usersFixture } from '../fixture/user';
import { createMockLogger, saveFixtures } from '../helpers';

const mockResolveOrganization = jest.fn();

jest.mock('../../src/integrations/bragi', () => ({
  getBragiClient: () => ({
    garmr: {
      execute: (fn: () => Promise<unknown>) => fn(),
    },
    instance: {
      resolveOrganization: (...args: unknown[]) =>
        mockResolveOrganization(...args),
    },
  }),
}));

const logger = createMockLogger();

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.clearAllMocks();
  nock.cleanAll();
  await saveFixtures(con, User, [usersFixture[0]]);
});

afterEach(() => {
  nock.cleanAll();
});

describe('enrichCompanyForUserCompany', () => {
  it('links to existing Company when domain matches', async () => {
    await saveFixtures(con, Company, [
      {
        id: 'existing-company',
        name: 'Existing Company',
        image: 'https://daily.dev/existing.png',
        domains: ['existing.com'],
      },
    ]);
    await saveFixtures(con, UserCompany, [
      {
        email: 'person@existing.com',
        code: '123456',
        userId: '1',
        companyId: null,
      },
    ]);

    const result = await enrichCompanyForUserCompany(
      con,
      {
        userCompanyEmail: 'person@existing.com',
        userCompanyUserId: '1',
        domain: 'existing.com',
      },
      logger,
    );

    const userCompany = await con.getRepository(UserCompany).findOneByOrFail({
      email: 'person@existing.com',
      userId: '1',
    });

    expect(result).toEqual({
      success: true,
      skipped: false,
      linkedToExisting: true,
      companyCreated: false,
      companyId: 'existing-company',
    });
    expect(userCompany.companyId).toBe('existing-company');
    expect(mockResolveOrganization).not.toHaveBeenCalled();
  });

  it('creates new Company when domain is unknown', async () => {
    nock('https://newco.com').get('/').reply(200);
    mockResolveOrganization.mockResolvedValue({
      englishName: 'New Co',
      nativeName: 'New Co Native',
      domain: 'newco.com',
    });
    await saveFixtures(con, UserCompany, [
      {
        email: 'person@newco.com',
        code: '123456',
        userId: '1',
        companyId: null,
      },
    ]);

    const result = await enrichCompanyForUserCompany(
      con,
      {
        userCompanyEmail: 'person@newco.com',
        userCompanyUserId: '1',
        domain: 'newco.com',
      },
      logger,
    );

    expect(result).toEqual({
      success: true,
      skipped: false,
      linkedToExisting: false,
      companyCreated: true,
      companyId: expect.any(String),
    });

    if (!result.companyId) {
      throw new Error('Company ID was not returned');
    }

    const company = await con.getRepository(Company).findOneByOrFail({
      id: result.companyId,
    });
    const userCompany = await con.getRepository(UserCompany).findOneByOrFail({
      email: 'person@newco.com',
      userId: '1',
    });

    expect(company).toMatchObject({
      id: result.companyId,
      name: 'New Co',
      altName: 'New Co Native',
      domains: ['newco.com'],
      image: getGoogleFaviconUrl('newco.com'),
      type: CompanyType.Company,
    });
    expect(userCompany.companyId).toBe(result.companyId);
    expect(mockResolveOrganization).toHaveBeenCalledWith({
      input: { case: 'domain', value: 'newco.com' },
    });
  });

  it('skips when the organization cannot be resolved', async () => {
    mockResolveOrganization.mockResolvedValue({
      englishName: '',
      nativeName: '',
      domain: 'unknown.com',
    });
    await saveFixtures(con, UserCompany, [
      {
        email: 'person@unknown.com',
        code: '123456',
        userId: '1',
        companyId: null,
      },
    ]);

    const result = await enrichCompanyForUserCompany(
      con,
      {
        userCompanyEmail: 'person@unknown.com',
        userCompanyUserId: '1',
        domain: 'unknown.com',
      },
      logger,
    );

    const userCompany = await con.getRepository(UserCompany).findOneByOrFail({
      email: 'person@unknown.com',
      userId: '1',
    });

    expect(result).toEqual({
      success: false,
      skipped: true,
      linkedToExisting: false,
      companyCreated: false,
      error: 'Missing englishName',
    });
    expect(userCompany.companyId).toBeNull();
  });
});

describe('isNonOrganizationName', () => {
  it('matches self-employment phrasings regardless of punctuation', () => {
    expect(
      [
        'Freelance',
        'self-employed',
        'Freelance (Self Employed)',
        'freelance | self-employed',
        'Self-Employed / Freelance',
        'N/A',
      ].every(isNonOrganizationName),
    ).toBe(true);
  });

  it('does not match real organizations with similar names', () => {
    expect(
      [
        'Freelancer.com',
        'Independent University, Bangladesh',
        'Upwork',
        'Various Industries Ltd',
      ].some(isNonOrganizationName),
    ).toBe(false);
  });
});

describe('enrichCompanyForExperience', () => {
  const saveExperience = (customCompanyName: string) =>
    con.getRepository(UserExperienceWork).save({
      userId: '1',
      title: 'Software Engineer',
      startedAt: new Date('2020-01-01'),
      type: UserExperienceType.Work,
      verified: false,
      customCompanyName,
      companyId: null,
    });

  const enrich = (experienceId: string, customCompanyName: string) =>
    enrichCompanyForExperience(
      con,
      {
        experienceId,
        customCompanyName,
        experienceType: UserExperienceType.Work,
      },
      logger,
    );

  it('links a known domain without checking whether the site is reachable', async () => {
    // No nock interceptor: any outbound request would throw, so this passing
    // proves validation was skipped for a company we already store.
    await saveFixtures(con, Company, [
      {
        id: 'tcs',
        name: 'TCS',
        image: 'https://daily.dev/tcs.png',
        domains: ['tcs.com'],
      },
    ]);
    const experience = await saveExperience('Tata Consultancy Services');
    mockResolveOrganization.mockResolvedValue({
      englishName: 'Tata Consultancy Services',
      nativeName: 'Tata Consultancy Services',
      domain: 'tcs.com',
    });

    const result = await enrich(experience.id, 'Tata Consultancy Services');

    expect(result).toMatchObject({
      success: true,
      linkedToExisting: true,
      companyId: 'tcs',
    });
    const updated = await con
      .getRepository(UserExperience)
      .findOneByOrFail({ id: experience.id });
    expect(updated.companyId).toBe('tcs');
  });

  it('links a stored www domain when the resolved domain is bare', async () => {
    await saveFixtures(con, Company, [
      {
        id: 'cairo',
        name: 'Cairo University',
        image: 'https://daily.dev/cu.png',
        domains: ['www.cu.edu.eg'],
      },
    ]);
    const experience = await saveExperience('Cairo University');
    mockResolveOrganization.mockResolvedValue({
      englishName: 'Cairo University',
      nativeName: 'جامعة القاهرة',
      domain: 'cu.edu.eg',
    });

    const result = await enrich(experience.id, 'Cairo University');

    expect(result).toMatchObject({
      linkedToExisting: true,
      companyId: 'cairo',
    });
  });

  it('creates the company when the domain serves an unverifiable certificate', async () => {
    nock('https://selfsigned.edu')
      .get('/')
      .replyWithError({ message: 'unable to verify the first certificate' });
    const experience = await saveExperience('Selfsigned University');
    mockResolveOrganization.mockResolvedValue({
      englishName: 'Selfsigned University',
      nativeName: 'Selfsigned University',
      domain: 'selfsigned.edu',
    });

    const result = await enrich(experience.id, 'Selfsigned University');

    expect(result).toMatchObject({ success: true, companyCreated: true });
    const company = await con
      .getRepository(Company)
      .findOneByOrFail({ id: result.companyId as string });
    expect(company.domains).toEqual(['selfsigned.edu']);
  });

  it('links via the domain the user typed, without asking bragi', async () => {
    await saveFixtures(con, Company, [
      {
        id: 'sharp',
        name: 'Sharp Software Solutions',
        image: 'https://daily.dev/sharp.png',
        domains: ['sharpsoftwaresolutions.net'],
      },
    ]);
    const experience = await saveExperience('Sharp Software Solutions');

    const result = await enrichCompanyForExperience(
      con,
      {
        experienceId: experience.id,
        customCompanyName: 'Sharp Software Solutions',
        experienceType: UserExperienceType.Work,
        customDomain: 'sharpsoftwaresolutions.net',
      },
      logger,
    );

    expect(result).toMatchObject({
      linkedToExisting: true,
      companyId: 'sharp',
    });
    expect(mockResolveOrganization).not.toHaveBeenCalled();
  });

  it('never creates a company from the typed domain, since it is unvalidated input', async () => {
    mockResolveOrganization.mockResolvedValue({
      englishName: '',
      nativeName: '',
      domain: '',
    });
    const experience = await saveExperience('Typo Inc');

    const result = await enrichCompanyForExperience(
      con,
      {
        experienceId: experience.id,
        customCompanyName: 'Typo Inc',
        experienceType: UserExperienceType.Work,
        customDomain: 'goggle.com',
      },
      logger,
    );

    expect(result.companyCreated).toBe(false);
    expect(
      await con.getRepository(Company).findOneBy({ domains: ['goggle.com'] }),
    ).toBeNull();
    // falls through to bragi rather than minting a company from a typo
    expect(mockResolveOrganization).toHaveBeenCalled();
  });

  it('skips non-organization names without calling bragi', async () => {
    const experience = await saveExperience('Freelance');

    const result = await enrich(experience.id, 'Freelance');

    expect(result).toMatchObject({
      success: false,
      skipped: true,
      error: 'Not an organization',
    });
    expect(mockResolveOrganization).not.toHaveBeenCalled();
  });
});
