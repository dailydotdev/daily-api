import nock from 'nock';
import worker from '../../src/workers/userUpdatedPlusSubscriptionCustomFeed';
import { ChangeObject } from '../../src/types';
import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import { User, Feed } from '../../src/entity';
import { ghostUser, PubSubSchema } from '../../src/common';
import { typedWorkers } from '../../src/workers';
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
  await saveFixtures(con, User, usersFixture);
  await con.getRepository(Feed).save({
    id: '1',
    userId: '1',
  });
  jest.clearAllMocks();
  nock.cleanAll();
});

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('userUpdatedPlusSubscriptionCustomFeed', () => {
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
    notificationEmail: true,
    acceptedMarketing: true,
    followingEmail: true,
    subscriptionFlags: JSON.stringify({}),
  };

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should create custom feed for user', async () => {
    const newBase = {
      ...base,
      subscriptionFlags: JSON.stringify({ subscriptionId: '1234' }),
    };
    await expectSuccessfulTypedBackground(worker, {
      newProfile: newBase,
      user: base,
    } as unknown as PubSubSchema['user-updated']);
    const feed = await con.getRepository('Feed').findOneBy({
      id: `cf-${newBase.id}`,
      userId: newBase.id,
    });
    expect(feed.id).toEqual(`cf-${newBase.id}`);
    expect(feed.flags.name).toEqual('My new feed');
    expect(feed.flags.icon).toEqual('🤓');
  });

  it('should not add feed if user is ghost user', async () => {
    const before: ChangeObject<ObjectType> = { ...base, id: ghostUser.id };
    await expectSuccessfulTypedBackground(worker, {
      newProfile: before,
      user: before,
    } as unknown as PubSubSchema['user-updated']);
    const feed = await con.getRepository('Feed').findOneBy({
      id: `cf-${base.id}`,
      userId: base.id,
    });
    expect(feed).toEqual(null);
  });

  it('should not add feed if user is not confirmed', async () => {
    const before: ChangeObject<ObjectType> = { ...base, infoConfirmed: false };
    await expectSuccessfulTypedBackground(worker, {
      newProfile: before,
      user: before,
    } as unknown as PubSubSchema['user-updated']);
    const feed = await con.getRepository('Feed').findOneBy({
      id: `cf-${base.id}`,
      userId: base.id,
    });
    expect(feed).toEqual(null);
  });

  it('should not add feed if flags empty', async () => {
    const before: ChangeObject<ObjectType> = { ...base, flags: '{}' };
    await expectSuccessfulTypedBackground(worker, {
      newProfile: before,
      user: before,
    } as unknown as PubSubSchema['user-updated']);
    const feed = await con.getRepository('Feed').findOneBy({
      id: `cf-${base.id}`,
      userId: base.id,
    });
    expect(feed).toEqual(null);
  });

  it('should not add feed if flags the same', async () => {
    const before: ChangeObject<ObjectType> = {
      ...base,
      flags: '{subscriptionId: "1234"}',
    };
    await expectSuccessfulTypedBackground(worker, {
      newProfile: before,
      user: before,
    } as unknown as PubSubSchema['user-updated']);
    const feed = await con.getRepository('Feed').findOneBy({
      id: `cf-${base.id}`,
      userId: base.id,
    });
    expect(feed).toEqual(null);
  });
});
