import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/userCompanyApprovedCio';
import { User } from '../../src/entity';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { typedWorkers } from '../../src/workers';
import { usersFixture } from '../fixture';
import nock from 'nock';
import { ChangeObject } from '../../src/types';
import { PubSubSchema } from '../../src/common';
import { cioV2 as cio } from '../../src/cio';
import { UserCompany } from '../../src/entity/UserCompany';
import { Company } from '../../src/entity/Company';

jest.mock('../../src/cio', () => ({
  ...(jest.requireActual('../../src/cio') as Record<string, unknown>),
  cioV2: { request: { post: jest.fn() } },
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.clearAllMocks();
  nock.cleanAll();
  process.env.CIO_SITE_ID = 'wolololo';
});

describe('userCompanyApprovedCio worker', () => {
  type ObjectType = Partial<UserCompany>;
  const base: ChangeObject<ObjectType> = {
    userId: '1',
    code: '123456',
    email: 'chris@daily.dev',
    verified: true,
    createdAt: new Date().getTime(),
    updatedAt: new Date().getTime(),
    companyId: 'dailydev',
    flags: {},
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, User, [usersFixture[0]]);
    await con.getRepository(Company).save({
      id: 'dailydev',
      name: 'daily.dev',
      image: 'cloudinary.com/dailydev/121232121/image',
      domains: ['daily.dev', 'dailydev.com'],
    });
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should not update if no company id provided', async () => {
    await expectSuccessfulTypedBackground(worker, {
      userCompany: { ...base, companyId: null },
    } as unknown as PubSubSchema['api.v1.user-company-approved']);
    expect(cio.request.post).not.toHaveBeenCalled();
  });

  it('should not update if no company is not found', async () => {
    await expectSuccessfulTypedBackground(worker, {
      userCompany: { ...base, companyId: '1' },
    } as unknown as PubSubSchema['api.v1.user-company-approved']);
    expect(cio.request.post).not.toHaveBeenCalled();
  });

  it('should update customer.io', async () => {
    await expectSuccessfulTypedBackground(worker, {
      userCompany: base,
    } as unknown as PubSubSchema['api.v1.user-company-approved']);
    expect(cio.request.post).toHaveBeenCalledWith('undefined/entity', {
      identifiers: {
        object_type_id: '4',
        object_id: 'dailydev',
      },
      type: 'object',
      action: 'identify',
      attributes: {
        name: 'daily.dev',
        image: 'cloudinary.com/dailydev/121232121/image',
        domains: ['daily.dev', 'dailydev.com'],
      },
      cio_relationships: [
        {
          identifiers: {
            id: '1',
          },
        },
      ],
    });
  });
});
