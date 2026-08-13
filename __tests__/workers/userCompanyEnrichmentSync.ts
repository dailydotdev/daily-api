import nock from 'nock';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import worker from '../../src/workers/userCompanyEnrichment';
import { User } from '../../src/entity/user/User';
import { Company } from '../../src/entity/Company';
import { UserCompany } from '../../src/entity/UserCompany';
import { UserExperienceWork } from '../../src/entity/user/experiences/UserExperienceWork';
import { UserExperienceType } from '../../src/entity/user/experiences/types';
import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import { usersFixture } from '../fixture/user';

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

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.clearAllMocks();
  nock.cleanAll();
  await saveFixtures(con, User, [usersFixture[0]]);
  await saveFixtures(con, Company, [
    {
      id: 'acme',
      name: 'Acme',
      image: 'https://daily.dev/acme.png',
      domains: ['acme-corp.com'],
    },
  ]);
});

afterEach(() => {
  nock.cleanAll();
});

const saveUserCompany = (verified: boolean) =>
  con.getRepository(UserCompany).save({
    email: 'person@acme-corp.com',
    code: '123456',
    userId: '1',
    companyId: null,
    verified,
  });

const saveWorkExperience = () =>
  con.getRepository(UserExperienceWork).save({
    userId: '1',
    title: 'Software Engineer',
    startedAt: new Date('2020-01-01'),
    type: UserExperienceType.Work,
    verified: false,
    companyId: 'acme',
  });

const runWorker = () =>
  expectSuccessfulTypedBackground<'api.v1.user-company-enrichment'>(worker, {
    email: 'person@acme-corp.com',
    userId: '1',
  });

describe('userCompanyEnrichment verification sync', () => {
  it('verifies the work experience when the company resolves after the code was entered', async () => {
    await saveUserCompany(true);
    const experience = await saveWorkExperience();

    await runWorker();

    const updated = await con
      .getRepository(UserExperienceWork)
      .findOneByOrFail({ id: experience.id });

    expect(updated.verified).toBe(true);
  });

  it('does not verify anything while the email is still unverified', async () => {
    // Enrichment also runs when the email is first added, before any code is entered.
    await saveUserCompany(false);
    const experience = await saveWorkExperience();

    await runWorker();

    const updated = await con
      .getRepository(UserExperienceWork)
      .findOneByOrFail({ id: experience.id });

    expect(updated.verified).toBe(false);
  });
});
