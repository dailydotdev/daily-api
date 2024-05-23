import nock from 'nock';
import worker from '../../src/workers/userUpdatedCio';
import { ChangeObject } from '../../src/types';
import { expectSuccessfulTypedBackground } from '../helpers';
import { User } from '../../src/entity';
import { getShortGenericInviteLink, PubSubSchema } from '../../src/common';
import { cio } from '../../src/cio';
import { typedWorkers } from '../../src/workers';
import mocked = jest.mocked;

jest.mock('../../src/common', () => ({
  ...jest.requireActual('../../src/common'),
  getShortGenericInviteLink: jest.fn(),
}));

jest.mock('../../src/cio', () => ({
  ...(jest.requireActual('../../src/cio') as Record<string, unknown>),
  cio: { identify: jest.fn() },
}));

beforeEach(async () => {
  jest.clearAllMocks();
  nock.cleanAll();
  process.env.CIO_SITE_ID = 'wolololo';
});

describe('userUpdatedCio', () => {
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
    acceptedMarketing: true,
  };

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should update customer.io', async () => {
    const referral = 'https://dly.dev/12345678';
    mocked(getShortGenericInviteLink).mockImplementation(async () => referral);
    await expectSuccessfulTypedBackground(worker, {
      newProfile: base,
      user: base,
    } as unknown as PubSubSchema['user-updated']);
    expect(cio.identify).toHaveBeenCalledWith('1', {
      created_at: 1714577744,
      first_name: 'Customer',
      name: 'Customer IO',
      updated_at: 1714577744,
      username: 'cio',
      referral_link: referral,
      accepted_marketing: true,
      cio_subscription_preferences: {
        topics: {
          topic_4: true,
        },
      },
    });
  });

  it('should support accepted marketing false', async () => {
    mocked(getShortGenericInviteLink).mockImplementation(async () => '');
    await expectSuccessfulTypedBackground(worker, {
      newProfile: { ...base, acceptedMarketing: false },
      user: base,
    } as unknown as PubSubSchema['user-updated']);
    expect(
      mocked(cio.identify).mock.calls[0][1].cio_subscription_preferences,
    ).toEqual({
      topics: {
        topic_4: false,
      },
    });
  });

  it('should not update customer.io if user is ghost user', async () => {
    const before: ChangeObject<ObjectType> = { ...base, id: '404' };
    await expectSuccessfulTypedBackground(worker, {
      newProfile: before,
      user: before,
    } as unknown as PubSubSchema['user-updated']);
    expect(cio.identify).toHaveBeenCalledTimes(0);
  });

  it('should not update customer.io if user is not confirmed', async () => {
    const before: ChangeObject<ObjectType> = { ...base, infoConfirmed: false };
    await expectSuccessfulTypedBackground(worker, {
      newProfile: before,
      user: before,
    } as unknown as PubSubSchema['user-updated']);
    expect(cio.identify).toHaveBeenCalledTimes(0);
  });
});
