import cron from '../../src/cron/personalizedDigest';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
} from '../../src/entity';
import { usersFixture } from '../fixture/user';
import { notifyGeneratePersonalizedDigest } from '../../src/common';
import { logger } from '../../src/logger';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

jest.mock('../../src/common/pubsub', () => ({
  ...(jest.requireActual('../../src/common/pubsub') as Record<string, unknown>),
  notifyGeneratePersonalizedDigest: jest.fn(),
}));

describe('personalizedDigest cron', () => {
  const preferredDay = (new Date().getDay() + 1) % 7;

  beforeEach(async () => {
    jest.resetAllMocks();

    await saveFixtures(con, User, usersFixture);
    await con.getRepository(UserPersonalizedDigest).clear();
  });

  it('should schedule generation', async () => {
    const usersToSchedule = usersFixture;

    await con.getRepository(UserPersonalizedDigest).save(
      usersToSchedule.map((item) => ({
        userId: item.id,
        preferredDay,
      })),
    );

    await expectSuccessfulCron(cron);

    const scheduledPersonalizedDigests = await con
      .getRepository(UserPersonalizedDigest)
      .findBy({
        preferredDay,
      });

    expect(notifyGeneratePersonalizedDigest).toHaveBeenCalledTimes(
      usersToSchedule.length,
    );
    scheduledPersonalizedDigests.forEach((personalizedDigest) => {
      expect(notifyGeneratePersonalizedDigest).toHaveBeenCalledWith({
        log: expect.anything(),
        personalizedDigest,
        emailSendTimestamp: expect.any(Number),
        previousSendTimestamp: expect.any(Number),
        emailBatchId: expect.any(String),
      });
    });
    (notifyGeneratePersonalizedDigest as jest.Mock).mock.calls.forEach(
      (call) => {
        const { emailSendTimestamp, previousSendTimestamp } = call?.[0] || {};

        expect(emailSendTimestamp).toBeGreaterThan(previousSendTimestamp);
      },
    );
  });

  it('should only schedule generation for next day subscriptions', async () => {
    const [, ...usersToSchedule] = usersFixture;

    await con.getRepository(UserPersonalizedDigest).save(
      usersToSchedule.map((item) => ({
        userId: item.id,
        preferredDay,
      })),
    );

    await expectSuccessfulCron(cron);

    const scheduledPersonalizedDigests = await con
      .getRepository(UserPersonalizedDigest)
      .findBy({
        preferredDay,
      });

    expect(notifyGeneratePersonalizedDigest).toHaveBeenCalledTimes(
      usersToSchedule.length,
    );
    scheduledPersonalizedDigests.forEach((personalizedDigest) => {
      expect(notifyGeneratePersonalizedDigest).toHaveBeenCalledWith({
        log: expect.anything(),
        personalizedDigest,
        emailSendTimestamp: expect.any(Number),
        previousSendTimestamp: expect.any(Number),
        emailBatchId: expect.any(String),
      });
    });
    (notifyGeneratePersonalizedDigest as jest.Mock).mock.calls.forEach(
      (call) => {
        const { emailSendTimestamp, previousSendTimestamp } = call?.[0] || {};

        expect(emailSendTimestamp).toBeGreaterThan(previousSendTimestamp);
      },
    );
  });

  it('should log notify count', async () => {
    const [, ...usersToSchedule] = usersFixture;

    await con.getRepository(UserPersonalizedDigest).save(
      usersToSchedule.map((item) => ({
        userId: item.id,
        preferredDay,
      })),
    );

    const infoSpy = jest.spyOn(logger, 'info');
    await expectSuccessfulCron(cron);
    expect(infoSpy).toHaveBeenCalledTimes(2);
    expect(infoSpy).toHaveBeenCalledWith(
      {
        digestCount: usersToSchedule.length,
        emailBatchId: expect.any(String),
        sendType: UserPersonalizedDigestSendType.weekly,
      },
      'personalized digest sent',
    );
  });

  it('should not schedule generation for subscriptions with different sendType', async () => {
    const usersToSchedule = usersFixture;

    await con.getRepository(UserPersonalizedDigest).save(
      usersToSchedule.map((item) => ({
        userId: item.id,
        preferredDay,
        flags: {
          sendType: UserPersonalizedDigestSendType.workdays,
        },
      })),
    );

    await expectSuccessfulCron(cron);

    const personalizedDigestRowsForDay = await con
      .getRepository(UserPersonalizedDigest)
      .findBy({
        preferredDay,
      });

    expect(personalizedDigestRowsForDay).toHaveLength(usersToSchedule.length);
    expect(notifyGeneratePersonalizedDigest).toHaveBeenCalledTimes(0);
  });

  it('should schedule generation for subscriptions with weekly sendType', async () => {
    const usersToSchedule = usersFixture;

    await con.getRepository(UserPersonalizedDigest).save(
      usersToSchedule.map((item) => ({
        userId: item.id,
        preferredDay,
        flags: {
          sendType: UserPersonalizedDigestSendType.weekly,
        },
      })),
    );

    await expectSuccessfulCron(cron);

    const personalizedDigestRowsForDay = await con
      .getRepository(UserPersonalizedDigest)
      .findBy({
        preferredDay,
      });

    expect(personalizedDigestRowsForDay).toHaveLength(usersToSchedule.length);
    expect(notifyGeneratePersonalizedDigest).toHaveBeenCalledTimes(4);
  });
});
