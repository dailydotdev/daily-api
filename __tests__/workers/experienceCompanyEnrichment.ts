import nock from 'nock';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { triggerTypedEvent } from '../../src/common/typedPubsub';
import worker from '../../src/workers/experienceCompanyEnrichment';
import { typedWorkers } from '../../src/workers';
import { User } from '../../src/entity/user/User';
import { Company, CompanyType } from '../../src/entity/Company';
import { UserExperience } from '../../src/entity/user/experiences/UserExperience';
import { UserExperienceWork } from '../../src/entity/user/experiences/UserExperienceWork';
import { UserExperienceType } from '../../src/entity/user/experiences/types';
import { getGoogleFaviconUrl } from '../../src/common/companyEnrichment';
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

jest.mock('../../src/common/typedPubsub', () => ({
  ...(jest.requireActual('../../src/common/typedPubsub') as Record<
    string,
    unknown
  >),
  triggerTypedEvent: jest.fn(),
}));

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

const saveExperience = (
  overrides: Partial<UserExperienceWork> = {},
): Promise<UserExperienceWork> =>
  con.getRepository(UserExperienceWork).save({
    userId: '1',
    title: 'Software Engineer',
    startedAt: new Date('2020-01-01'),
    type: UserExperienceType.Work,
    verified: false,
    customCompanyName: 'Integrated Worlds',
    companyId: null,
    ...overrides,
  });

describe('experienceCompanyEnrichment worker', () => {
  it('should be registered', () => {
    expect(
      typedWorkers.find((item) => item.subscription === worker.subscription),
    ).toBeDefined();
  });

  it('creates the company, links the experience and notifies the user', async () => {
    mockResolveOrganization.mockResolvedValue({
      englishName: 'Integrated Worlds',
      nativeName: 'Integrated Worlds GmbH',
      domain: 'integrated-worlds.com',
    });
    nock('https://integrated-worlds.com').get('/').reply(200);

    const experience = await saveExperience();

    await expectSuccessfulTypedBackground<'api.v1.experience-company-enrichment'>(
      worker,
      { experienceId: experience.id },
    );

    const enriched = await con
      .getRepository(UserExperience)
      .findOneByOrFail({ id: experience.id });

    if (!enriched.companyId) {
      throw new Error('Experience was not enriched');
    }

    const company = await con
      .getRepository(Company)
      .findOneByOrFail({ id: enriched.companyId });

    expect(mockResolveOrganization).toHaveBeenCalledWith({
      input: { case: 'name', value: 'Integrated Worlds' },
    });
    expect(company).toMatchObject({
      name: 'Integrated Worlds',
      altName: 'Integrated Worlds GmbH',
      domains: ['integrated-worlds.com'],
      image: getGoogleFaviconUrl('integrated-worlds.com'),
      type: CompanyType.Company,
    });
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.experience-company-enriched',
      {
        experienceId: experience.id,
        userId: '1',
        companyId: enriched.companyId,
      },
    ]);
  });

  it('skips when the experience was linked to a company in the meantime', async () => {
    await saveFixtures(con, Company, [
      {
        id: 'existing-company',
        name: 'Existing Company',
        image: 'https://daily.dev/existing.png',
        domains: ['existing.com'],
      },
    ]);
    const experience = await saveExperience({
      companyId: 'existing-company',
    });

    await expectSuccessfulTypedBackground<'api.v1.experience-company-enrichment'>(
      worker,
      { experienceId: experience.id },
    );

    expect(mockResolveOrganization).not.toHaveBeenCalled();
    expect(triggerTypedEvent).not.toHaveBeenCalled();
  });

  it('does not notify when the organization cannot be resolved', async () => {
    mockResolveOrganization.mockResolvedValue({
      englishName: '',
      nativeName: '',
      domain: '',
    });
    const experience = await saveExperience();

    await expectSuccessfulTypedBackground<'api.v1.experience-company-enrichment'>(
      worker,
      { experienceId: experience.id },
    );

    const enriched = await con
      .getRepository(UserExperience)
      .findOneByOrFail({ id: experience.id });

    expect(enriched.companyId).toBeNull();
    expect(triggerTypedEvent).not.toHaveBeenCalled();
  });
});
