import { crons } from '../../src/cron/index';
import cron from '../../src/cron/validateActiveUsers';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import * as gcp from '../../src/common/googleCloud';
import * as cioModule from '../../src/cio';
import { DataSource, In, JsonContains } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
  UserPersonalizedDigestType,
} from '../../src/entity';
import { badUsersFixture, plusUsersFixture, usersFixture } from '../fixture';
import { updateFlagsStatement } from '../../src/common';
import { ioRedisPool } from '../../src/redis';
import { cioV2 } from '../../src/cio';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationPreferenceStatus,
  NotificationType,
} from '../../src/notifications/common';

let con: DataSource;

beforeEach(async () => {
  con = await createOrGetConnection();
  await ioRedisPool.execute((client) => client.flushall());
  jest.clearAllMocks();
  jest.resetModules();
  await saveFixtures(con, User, [
    ...usersFixture,
    ...plusUsersFixture,
    ...badUsersFixture,
  ]);
});

describe('validateActiveUsers', () => {
  beforeEach(async () => {
    await saveFixtures(con, User, usersFixture);
  });

  it('should be registered', () => {
    const registeredWorker = crons.find((item) => item.name === cron.name);

    expect(registeredWorker).toBeDefined();
  });
});

describe('users for downgrade', () => {
  it('should not do anything if users do not have digest subscription', async () => {
    jest.spyOn(gcp, 'getUsersActiveState').mockResolvedValue({
      reactivateUsers: [],
      inactiveUsers: [],
      downgradeUsers: ['4', '1'],
    });

    await con.getRepository(UserPersonalizedDigest).clear();
    await expectSuccessfulCron(cron);

    const digests = await con.getRepository(UserPersonalizedDigest).find();
    expect(digests.length).toEqual(0);
  });

  it('should downgrade daily digest to weekly digest', async () => {
    const downgradeUsers = ['4', '1'];

    jest.spyOn(gcp, 'getUsersActiveState').mockResolvedValue({
      reactivateUsers: [],
      inactiveUsers: [],
      downgradeUsers,
    });

    await con
      .getRepository(UserPersonalizedDigest)
      .createQueryBuilder()
      .update({
        preferredDay: 1,
        preferredHour: 4,
        type: UserPersonalizedDigestType.Brief,
        flags: updateFlagsStatement({
          digestSendType: UserPersonalizedDigestSendType.daily,
        }),
      })
      .execute();
    await expectSuccessfulCron(cron);

    const digests = await con.getRepository(UserPersonalizedDigest).find({
      where: {
        flags: JsonContains({
          digestSendType: UserPersonalizedDigestSendType.weekly,
        }),
      },
    });
    const downgradedOnly = digests.every(
      ({ userId, preferredDay, preferredHour }) =>
        downgradeUsers.includes(userId) &&
        preferredDay === 3 &&
        preferredHour === 9,
    );
    expect(downgradedOnly).toEqual(true);
  });

  it('should downgrade workdays digest to weekly digest', async () => {
    const downgradeUsers = ['4', '1'];

    jest.spyOn(gcp, 'getUsersActiveState').mockResolvedValue({
      reactivateUsers: [],
      inactiveUsers: [],
      downgradeUsers,
    });

    await con
      .getRepository(UserPersonalizedDigest)
      .createQueryBuilder()
      .update({
        preferredDay: 1,
        preferredHour: 4,
        flags: updateFlagsStatement({
          digestSendType: UserPersonalizedDigestSendType.workdays,
        }),
      })
      .execute();
    await expectSuccessfulCron(cron);

    const digests = await con.getRepository(UserPersonalizedDigest).find({
      where: {
        flags: JsonContains({
          digestSendType: UserPersonalizedDigestSendType.weekly,
        }),
      },
    });
    const downgradedOnly = digests.every(
      ({ userId, preferredDay, preferredHour }) =>
        downgradeUsers.includes(userId) &&
        preferredDay === 3 &&
        preferredHour === 9,
    );
    expect(downgradedOnly).toEqual(true);
  });
});

describe('users for removal', () => {
  it('should not do anything if users are removed to CIO already', async () => {
    jest.spyOn(gcp, 'getUsersActiveState').mockResolvedValue({
      reactivateUsers: ['1', '2'],
      inactiveUsers: ['3', '5'],
      downgradeUsers: ['4'],
    });

    const postSpy = jest
      .spyOn(cioModule.cioV2.request, 'post')
      .mockResolvedValue({});

    await con
      .getRepository(User)
      .update({ id: In(['3', '5']) }, { cioRegistered: false });

    await expectSuccessfulCron(cron);

    expect(postSpy).not.toHaveBeenCalled();
  });

  it('should send removal to cio', async () => {
    jest.spyOn(gcp, 'getUsersActiveState').mockResolvedValue({
      reactivateUsers: ['1', '2'],
      inactiveUsers: ['3', '5', 'vordr'],
      downgradeUsers: ['4'],
    });

    const postSpy = jest
      .spyOn(cioModule.cioV2.request, 'post')
      .mockResolvedValue({});

    await con
      .getRepository(User)
      .update({ id: In(['vordr']) }, { cioRegistered: false });
    const digests = await con.getRepository(UserPersonalizedDigest).count();
    expect(digests).toBeGreaterThan(0);

    await expectSuccessfulCron(cron);

    const batch = [
      {
        action: 'delete',
        type: 'person',
        identifiers: { id: '3' },
      },
      {
        action: 'delete',
        type: 'person',
        identifiers: { id: '5' },
      },
    ];

    expect(postSpy).toHaveBeenCalledWith(`${cioV2.trackRoot}/batch`, { batch });

    const fromRemovalOnly = postSpy.mock.calls[0][1].batch.every(
      ({ identifiers }) => ['3', '5'].includes(identifiers.id),
    );
    expect(fromRemovalOnly).toBeTruthy();

    const unRegisteredOnly = postSpy.mock.calls[0][1].batch.every(
      ({ identifiers }) => !['vordr'].includes(identifiers.id),
    );
    expect(unRegisteredOnly).toBeTruthy();

    const unregistered = await con
      .getRepository(User)
      .findOne({ select: ['cioRegistered'], where: { id: '3' } });
    expect(unregistered.cioRegistered).toEqual(false);

    const removed = await con.getRepository(UserPersonalizedDigest).count();
    expect(removed).toBeLessThan(digests);
  });
});

describe('users for reactivation', () => {
  it('should not do anything if users are registered to CIO already', async () => {
    jest.spyOn(gcp, 'getUsersActiveState').mockResolvedValue({
      reactivateUsers: ['1', '2'],
      inactiveUsers: ['3'],
      downgradeUsers: ['4'],
    });
    const postSpy = jest
      .spyOn(cioModule.cioV2.request, 'post')
      .mockResolvedValue({});

    // to stop running removal of `inactiveUsers`
    await con.getRepository(User).update({ id: '3' }, { cioRegistered: false });

    // default value for `cioRegistered` is true
    await expectSuccessfulCron(cron);

    expect(postSpy).not.toHaveBeenCalled();
  });

  it('should send reactivation to cio', async () => {
    jest.spyOn(gcp, 'getUsersActiveState').mockResolvedValue({
      reactivateUsers: ['1', '2'],
      inactiveUsers: ['3'],
      downgradeUsers: ['4'],
    });

    await con.getRepository(User).update(
      { id: '1' },
      {
        notificationFlags: {
          ...DEFAULT_NOTIFICATION_SETTINGS,
          [NotificationType.Marketing]: {
            email: NotificationPreferenceStatus.Muted,
            inApp: NotificationPreferenceStatus.Subscribed,
          },
        },
      },
    );

    const postSpy = jest
      .spyOn(cioModule.cioV2.request, 'post')
      .mockResolvedValue({});

    // to stop running removal of `inactiveUsers`
    await con
      .getRepository(User)
      .update({ id: In(['3', '1']) }, { cioRegistered: false });

    // default value for `cioRegistered` is true
    await expectSuccessfulCron(cron);

    const batch = [
      {
        action: 'identify',
        type: 'person',
        identifiers: { id: '1' },
        attributes: {
          'cio_subscription_preferences.topics.topic_1': true,
          'cio_subscription_preferences.topics.topic_4': false,
          'cio_subscription_preferences.topics.topic_5': true,
          'cio_subscription_preferences.topics.topic_8': true,
          'cio_subscription_preferences.topics.topic_11': true,
          'cio_subscription_preferences.topics.topic_12': true,
          'cio_subscription_preferences.topics.topic_13': true,
          'cio_subscription_preferences.topics.topic_14': true,
          'cio_subscription_preferences.topics.topic_15': true,
          'cio_subscription_preferences.topics.topic_16': true,
          'cio_subscription_preferences.topics.topic_17': true,
          'cio_subscription_preferences.topics.topic_18': true,
          'cio_subscription_preferences.topics.topic_19': true,
          'cio_subscription_preferences.topics.topic_20': true,
          'cio_subscription_preferences.topics.topic_22': true,
          'cio_subscription_preferences.topics.topic_23': true,
          'cio_subscription_preferences.topics.topic_24': true,
          'cio_subscription_preferences.topics.topic_25': true,
          'cio_subscription_preferences.topics.topic_26': true,
          'cio_subscription_preferences.topics.topic_27': true,
          'cio_subscription_preferences.topics.topic_28': true,
          created_at: 1656427727,
          first_name: 'Ido',
          name: 'Ido',
          permalink: 'http://localhost:5002/idoshamun',
          referral_link: 'http://localhost:5002/join?cid=generic&userid=1',
          updated_at: undefined,
          username: 'idoshamun',
        },
      },
    ];

    expect(postSpy).toHaveBeenCalledWith(`${cioV2.trackRoot}/batch`, { batch });

    const fromReactivateUserOnly = postSpy.mock.calls[0][1].batch.every(
      ({ identifiers }) => ['1'].includes(identifiers.id),
    );
    expect(fromReactivateUserOnly).toBeTruthy();

    const registeredOnly = postSpy.mock.calls[0][1].batch.every(
      ({ identifiers }) => identifiers.id !== '3',
    );
    expect(registeredOnly).toBeTruthy();

    const reactivated = await con
      .getRepository(User)
      .findOne({ select: ['cioRegistered'], where: { id: '1' } });
    expect(reactivated.cioRegistered).toEqual(true);
  });
});
