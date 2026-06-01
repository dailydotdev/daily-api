import nock from 'nock';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { triggerTypedEvent } from '../../../src/common';
import { User } from '../../../src/entity/user/User';
import { UserCompany } from '../../../src/entity/UserCompany';
import { Company, CompanyType } from '../../../src/entity/Company';
import { anthropicClient } from '../../../src/integrations/anthropic';
import cdcWorker from '../../../src/workers/cdc/primary';
import worker from '../../../src/workers/userCompanyEnrichment';
import { ChangeObject } from '../../../src/types';
import {
  expectSuccessfulBackground,
  expectSuccessfulTypedBackground,
  mockChangeMessage,
  saveFixtures,
} from '../../helpers';
import { usersFixture } from '../../fixture/user';
import { getGoogleFaviconUrl } from '../../../src/common/companyEnrichment';

jest.mock('../../../src/integrations/anthropic', () => ({
  anthropicClient: {
    createMessage: jest.fn(),
  },
}));

jest.mock('../../../src/common', () => ({
  ...(jest.requireActual('../../../src/common') as Record<string, unknown>),
  triggerTypedEvent: jest.fn(),
}));

const mockCreateMessage = jest.mocked(anthropicClient.createMessage);
const originalAnthropicApiKey = process.env.ANTHROPIC_API_KEY;

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  process.env.ANTHROPIC_API_KEY = 'test';
  jest.clearAllMocks();
  nock.cleanAll();
  await saveFixtures(con, User, [usersFixture[0]]);
});

afterEach(() => {
  process.env.ANTHROPIC_API_KEY = originalAnthropicApiKey;
  nock.cleanAll();
});

describe('user company enrichment CDC', () => {
  it('publishes enrichment for inserted UserCompany and publishes approval on companyId update', async () => {
    const email = 'person@integrated-worlds.com';
    const base: ChangeObject<UserCompany> = {
      userId: '1',
      code: '123456',
      email,
      verified: false,
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
      companyId: null,
      flags: {},
    };

    mockCreateMessage.mockResolvedValue({
      content: [
        {
          input: {
            englishName: 'Integrated Worlds',
            nativeName: 'Integrated Worlds GmbH',
          },
        },
      ],
    });
    nock('https://integrated-worlds.com').get('/').reply(200);

    await con.getRepository(UserCompany).save({
      userId: base.userId,
      code: base.code,
      email,
      verified: base.verified,
      companyId: null,
    });

    await expectSuccessfulBackground(
      cdcWorker,
      mockChangeMessage<UserCompany>({
        after: base,
        before: null,
        op: 'c',
        table: 'user_company',
      }),
    );

    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.user-company-enrichment',
      { email, userId: '1' },
    ]);

    jest.clearAllMocks();

    await expectSuccessfulTypedBackground<'api.v1.user-company-enrichment'>(
      worker,
      { email, userId: '1' },
    );

    const userCompany = await con.getRepository(UserCompany).findOneByOrFail({
      email,
      userId: '1',
    });

    if (!userCompany.companyId) {
      throw new Error('User company was not enriched');
    }

    const company = await con.getRepository(Company).findOneByOrFail({
      id: userCompany.companyId,
    });

    expect(company).toMatchObject({
      id: userCompany.companyId,
      name: 'Integrated Worlds',
      altName: 'Integrated Worlds GmbH',
      domains: ['integrated-worlds.com'],
      image: getGoogleFaviconUrl('integrated-worlds.com'),
      type: CompanyType.Company,
    });

    jest.clearAllMocks();

    const after: ChangeObject<UserCompany> = {
      ...base,
      companyId: userCompany.companyId,
      updatedAt: new Date().getTime(),
    };

    await expectSuccessfulBackground(
      cdcWorker,
      mockChangeMessage<UserCompany>({
        after,
        before: base,
        op: 'u',
        table: 'user_company',
      }),
    );

    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)).toEqual([
      'api.v1.user-company-approved',
      { userCompany: after },
    ]);
  });
});
