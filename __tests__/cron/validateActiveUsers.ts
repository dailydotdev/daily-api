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
} from '../../src/entity';
import { badUsersFixture, plusUsersFixture, usersFixture } from '../fixture';
import { updateFlagsStatement } from '../../src/common';
import { ioRedisPool } from '../../src/redis';

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

  it('should NOT be registered yet', () => {
    const registeredWorker = crons.find((item) => item.name === cron.name);

    expect(registeredWorker).not.toBeDefined();
  });
});

describe('users for downgrade', () => {
  it('should not do anything if users do not have digest subscription', async () => {
    jest.spyOn(gcp, 'getUsersActiveState').mockResolvedValue({
      reactivateUsers: [],
      inactiveUsers: [],
      downgradeUsers: ['4', '1'],
    });

    await con.getRepository(UserPersonalizedDigest).delete({});
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

    await con.getRepository(UserPersonalizedDigest).update(
      {},
      {
        preferredDay: 1,
        preferredHour: 4,
        flags: updateFlagsStatement({
          digestSendType: UserPersonalizedDigestSendType.workdays,
        }),
      },
    );
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
        action: 'destroy',
        type: 'person',
        identifiers: { id: '3' },
      },
      {
        action: 'destroy',
        type: 'person',
        identifiers: { id: '5' },
      },
    ];

    expect(postSpy).toHaveBeenCalledWith('/users', { batch });

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
          name: 'Ido',
          email: 'ido@daily.dev',
          image: 'https://daily.dev/ido.jpg',
          cover: null,
          company: null,
          title: null,
          accepted_marketing: false,
          reputation: 10,
          username: 'idoshamun',
          twitter: null,
          github: 'idogithub',
          roadmap: null,
          threads: null,
          codepen: null,
          reddit: null,
          stackoverflow: null,
          youtube: null,
          linkedin: null,
          mastodon: null,
          portfolio: null,
          hashnode: null,
          cio_registered: false,
          timezone: 'Etc/UTC',
          week_start: 1,
          created_at: 1656427727,
          updated_at: undefined,
          referral_id: null,
          referral_origin: null,
          acquisition_channel: null,
          experience_level: null,
          flags: {},
          language: null,
          default_feed_id: null,
          subscription_flags: {},
          permalink: 'http://localhost:5002/idoshamun',
          first_name: 'Ido',
          referral_link: 'http://localhost:5002/join?cid=generic&userid=1',
          'cio_subscription_preferences.topics.topic_4': false,
          'cio_subscription_preferences.topics.topic_7': true,
          'cio_subscription_preferences.topics.topic_8': true,
          'cio_subscription_preferences.topics.topic_9': true,
        },
      },
    ];

    expect(postSpy).toHaveBeenCalledWith('/users', { batch });

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
