import nock from 'nock';
import worker from '../../src/workers/userUpdatedCio';
import { ChangeObject } from '../../src/types';
import { expectSuccessfulTypedBackground } from '../helpers';
import {
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestType,
} from '../../src/entity';
import {
  getShortGenericInviteLink,
  ghostUser,
  PubSubSchema,
} from '../../src/common';
import { cio } from '../../src/cio';
import { typedWorkers } from '../../src/workers';
import mocked = jest.mocked;
import createOrGetConnection from '../../src/db';
import { DataSource } from 'typeorm';
import { usersFixture } from '../fixture/user';

jest.mock('../../src/common', () => ({
  ...jest.requireActual('../../src/common'),
  getShortGenericInviteLink: jest.fn(),
  resubscribeUser: jest.fn(),
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

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('userUpdatedCio', () => {
  type ObjectType = Partial<User>;
  const base: ChangeObject<ObjectType> = {
    id: 'uucu1',
    username: 'cio',
    name: 'Customer IO',
    infoConfirmed: true,
    createdAt: 1714577744717000,
    updatedAt: 1714577744717000,
    bio: 'bio',
    readme: 'readme',
    notificationEmail: true,
    acceptedMarketing: true,
    followingEmail: true,
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
    expect(cio.identify).toHaveBeenCalledWith('uucu1', {
      created_at: 1714577744,
      first_name: 'Customer',
      name: 'Customer IO',
      updated_at: 1714577744,
      username: 'cio',
      referral_link: referral,
      accepted_marketing: true,
      'cio_subscription_preferences.topics.topic_4': true,
      'cio_subscription_preferences.topics.topic_7': true,
      'cio_subscription_preferences.topics.topic_8': false,
      'cio_subscription_preferences.topics.topic_9': true,
    });
  });

  it('should support accepted marketing false', async () => {
    mocked(getShortGenericInviteLink).mockImplementation(async () => '');
    await expectSuccessfulTypedBackground(worker, {
      newProfile: { ...base, acceptedMarketing: false },
      user: base,
    } as unknown as PubSubSchema['user-updated']);
    expect(mocked(cio.identify).mock.calls[0][1]).toMatchObject({
      'cio_subscription_preferences.topics.topic_4': false,
      'cio_subscription_preferences.topics.topic_7': true,
      'cio_subscription_preferences.topics.topic_8': false,
      'cio_subscription_preferences.topics.topic_9': true,
    });
  });

  it('should not update customer.io if user is ghost user', async () => {
    const before: ChangeObject<ObjectType> = { ...base, id: ghostUser.id };
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

  it('should support following email false', async () => {
    mocked(getShortGenericInviteLink).mockImplementation(async () => '');
    await expectSuccessfulTypedBackground(worker, {
      newProfile: { ...base, followingEmail: false },
      user: base,
    } as unknown as PubSubSchema['user-updated']);
    expect(mocked(cio.identify).mock.calls[0][1]).toMatchObject({
      'cio_subscription_preferences.topics.topic_4': true,
      'cio_subscription_preferences.topics.topic_7': true,
      'cio_subscription_preferences.topics.topic_8': false,
      'cio_subscription_preferences.topics.topic_9': false,
    });
  });

  it('should support digest subscription', async () => {
    mocked(getShortGenericInviteLink).mockImplementation(async () => '');

    await con.getRepository(User).save({
      ...usersFixture[0],
      id: 'uucu1',
      github: 'uucu1',
      hashnode: 'uucu1',
      email: 'uucu1@daily.dev',
      twitter: 'uucu1',
      username: 'uucu1',
    });
    await con.getRepository(UserPersonalizedDigest).findBy({
      userId: 'uucu1',
      type: UserPersonalizedDigestType.Digest,
    });

    await expectSuccessfulTypedBackground(worker, {
      newProfile: { ...base },
      user: base,
    } as unknown as PubSubSchema['user-updated']);
    expect(mocked(cio.identify).mock.calls[0][1]).toMatchObject({
      'cio_subscription_preferences.topics.topic_4': true,
      'cio_subscription_preferences.topics.topic_7': true,
      'cio_subscription_preferences.topics.topic_8': true,
      'cio_subscription_preferences.topics.topic_9': true,
    });
  });
});
