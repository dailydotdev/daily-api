import nock from 'nock';
import { userUpdatedPlusSubscriptionBriefWorker as worker } from '../../src/workers/userUpdatedPlusSubscriptionBrief';
import { ChangeObject } from '../../src/types';
import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import {
  User,
  Feed,
  UserPersonalizedDigest,
  UserPersonalizedDigestType,
  UserPersonalizedDigestSendType,
} from '../../src/entity';
import { typedWorkers } from '../../src/workers';
import createOrGetConnection from '../../src/db';
import { DataSource } from 'typeorm';
import { usersFixture } from '../fixture/user';
import type { PubSubSchema } from '../../src/common/typedPubsub';
import { ghostUser, updateFlagsStatement } from '../../src/common/utils';

jest.mock('../../src/common', () => ({
  ...jest.requireActual('../../src/common'),
  getShortGenericInviteLink: jest.fn(),
  resubscribeUser: jest.fn(),
}));

jest.mock('../../src/cio', () => ({
  ...(jest.requireActual('../../src/cio') as Record<string, unknown>),
  cio: { identify: jest.fn() },
}));

describe('userUpdatedPlusSubscriptionBrief worker', () => {
  let con: DataSource;

  beforeEach(async () => {
    await saveFixtures(con, User, usersFixture);
    await con.getRepository(Feed).save({
      id: '1',
      userId: '1',
    });

    await con.getRepository(UserPersonalizedDigest).save({
      userId: '1',
      type: UserPersonalizedDigestType.Digest,
      flags: {
        sendType: UserPersonalizedDigestSendType.workdays,
      },
      preferredDay: 1,
      preferredHour: 16,
    });

    jest.resetAllMocks();
    nock.cleanAll();
  });

  beforeAll(async () => {
    con = await createOrGetConnection();
  });

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

  it('should replace digest with brief when user becomes plus', async () => {
    const newBase = {
      ...base,
      subscriptionFlags: JSON.stringify({ subscriptionId: '1234' }),
    };

    const digestBefore = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: newBase.id,
        type: UserPersonalizedDigestType.Digest,
      });

    expect(digestBefore).toBeDefined();

    await expectSuccessfulTypedBackground(worker, {
      newProfile: newBase,
      user: base,
    } as unknown as PubSubSchema['user-updated']);

    const digestAfter = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: newBase.id,
        type: UserPersonalizedDigestType.Brief,
      });

    expect(digestAfter).toMatchObject({
      userId: newBase.id,
      type: UserPersonalizedDigestType.Brief,
      flags: {
        sendType: UserPersonalizedDigestSendType.daily,
      },
      preferredDay: 1,
      preferredHour: 16,
    });
  });

  it('should not replace subscription if user is special user', async () => {
    const before: ChangeObject<ObjectType> = { ...base, id: ghostUser.id };

    const digestBefore = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: before.id,
        type: UserPersonalizedDigestType.Digest,
      });

    expect(digestBefore).toBeDefined();

    await expectSuccessfulTypedBackground(worker, {
      newProfile: before,
      user: before,
    } as unknown as PubSubSchema['user-updated']);

    const digestAfter = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: before.id,
        type: UserPersonalizedDigestType.Brief,
      });

    expect(digestAfter).toBeNull();
  });

  it('should not replace subscription if user is not confirmed', async () => {
    const before: ChangeObject<ObjectType> = { ...base, infoConfirmed: false };

    const digestBefore = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: before.id,
        type: UserPersonalizedDigestType.Digest,
      });

    expect(digestBefore).toBeDefined();

    await expectSuccessfulTypedBackground(worker, {
      newProfile: before,
      user: before,
    } as unknown as PubSubSchema['user-updated']);

    const digestAfter = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: before.id,
        type: UserPersonalizedDigestType.Brief,
      });

    expect(digestAfter).toBeNull();
  });

  it('should not replace subscription if flags empty', async () => {
    const before: ChangeObject<ObjectType> = {
      ...base,
      subscriptionFlags: JSON.stringify({}),
    };

    const digestBefore = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: before.id,
        type: UserPersonalizedDigestType.Digest,
      });

    expect(digestBefore).toBeDefined();

    await expectSuccessfulTypedBackground(worker, {
      newProfile: before,
      user: before,
    } as unknown as PubSubSchema['user-updated']);

    const digestAfter = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: before.id,
        type: UserPersonalizedDigestType.Brief,
      });

    expect(digestAfter).toBeNull();
  });

  it('should not replace subscription if flags the same', async () => {
    const before: ChangeObject<ObjectType> = {
      ...base,
      subscriptionFlags: JSON.stringify({ subscriptionId: '1234' }),
    };

    const digestBefore = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: before.id,
        type: UserPersonalizedDigestType.Digest,
      });

    expect(digestBefore).toBeDefined();

    await expectSuccessfulTypedBackground(worker, {
      newProfile: before,
      user: before,
    } as unknown as PubSubSchema['user-updated']);

    const digestAfter = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: before.id,
        type: UserPersonalizedDigestType.Brief,
      });

    expect(digestAfter).toBeNull();
  });

  it('should replace brief with digest when user is no longer plus', async () => {
    await con.getRepository(UserPersonalizedDigest).update(
      {
        userId: base.id,
        type: UserPersonalizedDigestType.Digest,
      },
      {
        type: UserPersonalizedDigestType.Brief,
        flags: updateFlagsStatement<UserPersonalizedDigest>({
          sendType: UserPersonalizedDigestSendType.daily,
        }),
      },
    );

    const oldBase = {
      ...base,
      subscriptionFlags: JSON.stringify({ subscriptionId: '1234' }),
    };

    const digestBefore = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: base.id,
        type: UserPersonalizedDigestType.Brief,
      });

    expect(digestBefore).toBeDefined();

    await expectSuccessfulTypedBackground(worker, {
      newProfile: base,
      user: oldBase,
    } as unknown as PubSubSchema['user-updated']);

    const digestAfter = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: base.id,
        type: UserPersonalizedDigestType.Digest,
      });

    expect(digestAfter).toMatchObject({
      userId: base.id,
      type: UserPersonalizedDigestType.Digest,
      flags: {
        sendType: UserPersonalizedDigestSendType.workdays,
      },
      preferredDay: 1,
      preferredHour: 16,
    });
  });

  it('should not replace subscription if user is not subscribed to digest', async () => {
    await con.getRepository(UserPersonalizedDigest).delete({
      userId: base.id,
      type: UserPersonalizedDigestType.Digest,
    });

    const digestbase = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: base.id,
        type: UserPersonalizedDigestType.Digest,
      });

    expect(digestbase).toBeNull();

    await expectSuccessfulTypedBackground(worker, {
      newProfile: base,
      user: base,
    } as unknown as PubSubSchema['user-updated']);

    const digestAfter = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: base.id,
        type: UserPersonalizedDigestType.Brief,
      });

    expect(digestAfter).toBeNull();
  });
});
