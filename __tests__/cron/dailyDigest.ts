import cron from '../../src/cron/dailyDigest';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
} from '../../src/entity';
import { usersFixture } from '../fixture/user';
import {
  createEmailBatchId,
  digestPreferredHourOffset,
  notifyGeneratePersonalizedDigest,
} from '../../src/common';
import { logger } from '../../src/logger';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

jest.mock('../../src/common/mailing', () => ({
  ...(jest.requireActual('../../src/common/mailing') as Record<
    string,
    unknown
  >),
  createEmailBatchId: jest.fn(),
}));

jest.mock('../../src/common/pubsub', () => ({
  ...(jest.requireActual('../../src/common/pubsub') as Record<string, unknown>),
  notifyGeneratePersonalizedDigest: jest.fn(),
}));

const sendType = UserPersonalizedDigestSendType.workdays;

let fakePreferredHour = 9;

describe('dailyDigest cron', () => {
  const preferredDay = (new Date().getDay() + 1) % 7;

  beforeEach(async () => {
    jest.resetAllMocks();

    await saveFixtures(con, User, usersFixture);
    await con.getRepository(UserPersonalizedDigest).clear();

    (createEmailBatchId as jest.Mock).mockResolvedValue('test-email-batch-id');

    const currentDate = new Date();
    fakePreferredHour = currentDate.getHours() + digestPreferredHourOffset;
  });

  it('should schedule generation', async () => {
    const usersToSchedule = usersFixture;

    await con.getRepository(UserPersonalizedDigest).save(
      usersToSchedule.map((item) => ({
        userId: item.id,
        preferredDay,
        preferredHour: fakePreferredHour,
        flags: {
          sendType,
        },
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
        emailBatchId: 'test-email-batch-id',
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
        preferredHour: fakePreferredHour,
        flags: {
          sendType,
        },
      })),
    );

    const infoSpy = jest.spyOn(logger, 'info');
    await expectSuccessfulCron(cron);
    expect(infoSpy).toHaveBeenCalledTimes(2);
    expect(infoSpy).toHaveBeenCalledWith(
      {
        digestCount: usersToSchedule.length,
        emailBatchId: 'test-email-batch-id',
        sendType,
      },
      'personalized digest sent',
    );
  });

  it('should log email batch id', async () => {
    const usersToSchedule = usersFixture;

    await con.getRepository(UserPersonalizedDigest).save(
      usersToSchedule.map((item) => ({
        userId: item.id,
        preferredDay,
        preferredHour: fakePreferredHour,
        flags: {
          sendType,
        },
      })),
    );
    const infoSpy = jest.spyOn(logger, 'info');

    await expectSuccessfulCron(cron);

    expect(infoSpy).toHaveBeenCalledTimes(2);
    expect(infoSpy).toHaveBeenCalledWith(
      { emailBatchId: 'test-email-batch-id', sendType },
      'starting personalized digest send',
    );
    expect(createEmailBatchId).toHaveBeenCalledTimes(1);
  });

  it('should throw when email batch id is not created', async () => {
    const usersToSchedule = usersFixture;

    await con.getRepository(UserPersonalizedDigest).save(
      usersToSchedule.map((item) => ({
        userId: item.id,
        preferredDay,
        preferredHour: fakePreferredHour,
        flags: {
          sendType,
        },
      })),
    );

    (createEmailBatchId as jest.Mock).mockResolvedValueOnce(undefined);

    await expect(() => {
      return expectSuccessfulCron(cron);
    }).rejects.toEqual(new Error('failed to create email batch id'));
  });

  it('should not schedule generation for subscriptions with different sendType', async () => {
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
    expect(notifyGeneratePersonalizedDigest).toHaveBeenCalledTimes(0);
  });

  it('should not schedule generation for subscriptions without sendType', async () => {
    const usersToSchedule = usersFixture;

    await con.getRepository(UserPersonalizedDigest).save(
      usersToSchedule.map((item) => ({
        userId: item.id,
        preferredDay,
        flags: {},
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
});
