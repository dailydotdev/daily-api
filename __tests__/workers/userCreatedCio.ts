import nock from 'nock';
import worker from '../../src/workers/userCreatedCio';
import { ChangeObject } from '../../src/types';
import { expectSuccessfulTypedBackground } from '../helpers';
import { User } from '../../src/entity';
import { PubSubSchema } from '../../src/common';
import { cio } from '../../src/cio';
import { typedWorkers } from '../../src/workers';

jest.mock('../../src/cio', () => ({
  ...(jest.requireActual('../../src/cio') as Record<string, unknown>),
  cio: { identify: jest.fn() },
}));

beforeEach(async () => {
  jest.clearAllMocks();
  nock.cleanAll();
  process.env.CIO_SITE_ID = 'wolololo';
});

describe('userCreatedCio', () => {
  type ObjectType = Partial<User>;
  const base: ChangeObject<ObjectType> = {
    id: '1',
    username: 'cio',
    name: 'Customer IO',
    infoConfirmed: true,
    createdAt: 1714577744717000,
    updatedAt: 1714577744717000,
    bio: 'bio',
    readme: 'readme',
  };

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should update customer.io', async () => {
    await expectSuccessfulTypedBackground(worker, {
      user: base,
    } as unknown as PubSubSchema['api.v1.user-created']);
    expect(cio.identify).toHaveBeenCalledWith('1', {
      created_at: 1714577744,
      first_name: 'Customer',
      name: 'Customer IO',
      updated_at: 1714577744,
      username: 'cio',
    });
  });

  it('should not update customer.io if user is ghost user', async () => {
    const before: ChangeObject<ObjectType> = { ...base, id: '404' };
    await expectSuccessfulTypedBackground(worker, {
      user: before,
    } as unknown as PubSubSchema['api.v1.user-created']);
    expect(cio.identify).toHaveBeenCalledTimes(0);
  });

  it('should not update customer.io if user is not confirmed', async () => {
    const before: ChangeObject<ObjectType> = { ...base, infoConfirmed: false };
    await expectSuccessfulTypedBackground(worker, {
      user: before,
    } as unknown as PubSubSchema['api.v1.user-created']);
    expect(cio.identify).toHaveBeenCalledTimes(0);
  });
});
