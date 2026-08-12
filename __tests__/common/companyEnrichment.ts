import nock from 'nock';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  enrichCompanyForUserCompany,
  getGoogleFaviconUrl,
} from '../../src/common/companyEnrichment';
import { Company, CompanyType } from '../../src/entity/Company';
import { UserCompany } from '../../src/entity/UserCompany';
import { User } from '../../src/entity/user/User';
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
