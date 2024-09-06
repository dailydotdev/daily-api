import cron from '../../src/cron/personalizedDigest';
import { doNotFake, expectSuccessfulCron, saveFixtures } from '../helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
} from '../../src/entity';
import { usersFixture } from '../fixture/user';
import {
  digestPreferredHourOffset,
  notifyGeneratePersonalizedDigest,
} from '../../src/common';
import { addDays, format, setDay, setHours, startOfHour } from 'date-fns';
import { logger } from '../../src/logger';
import { zonedTimeToUtc } from 'date-fns-tz';
import { crons } from '../../src/cron/index';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

jest.mock('../../src/common/pubsub', () => ({
  ...(jest.requireActual('../../src/common/pubsub') as Record<string, unknown>),
  notifyGeneratePersonalizedDigest: jest.fn(),
}));

let digestTime = 'NOW()';

jest.mock('../../src/common/personalizedDigest', () => ({
  ...(jest.requireActual('../../src/common/personalizedDigest') as Record<
    string,
    unknown
  >),
  getDigestCronTime: () => digestTime,
}));

function clampToHours(num: number): number {
  return ((num % 24) + 24) % 24;
}

describe('personalizedDigest cron', () => {
  const sendType = UserPersonalizedDigestSendType.weekly;
  const preferredDay = new Date().getDay();
  let fakePreferredHour = 9;

  beforeEach(async () => {
    jest.resetAllMocks();

    await saveFixtures(con, User, usersFixture);
    await con.getRepository(UserPersonalizedDigest).clear();

    const currentDate = new Date();
    fakePreferredHour = clampToHours(
      currentDate.getHours() + digestPreferredHourOffset,
    );

    jest
      .useFakeTimers({
        doNotFake,
      })
      // set day to Tuesday to avoid weekend overlaps
      .setSystemTime(setDay(currentDate, 2));

    await saveFixtures(con, User, usersFixture);
    await con.getRepository(UserPersonalizedDigest).clear();
  });

  afterEach(() => {
    jest.useRealTimers();

    digestTime = 'NOW()';
  });

  it('should be registered', () => {
    const registeredWorker = crons.find((item) => item.name === cron.name);

    expect(registeredWorker).toBeDefined();
  });

  it('should schedule generation for interval', async () => {
    const usersToSchedule = usersFixture;

    await con.getRepository(UserPersonalizedDigest).save(
      usersToSchedule.map((item) => ({
        userId: item.id,
        preferredDay,
        preferredHour: fakePreferredHour,
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

  it('should schedule generation for specific date', async () => {
    const usersToSchedule = usersFixture;

    const fakePreferredDay = 3;
    const fakeDate = setHours(
      new Date('2024-09-11T10:32:42.680Z'),
      fakePreferredHour - digestPreferredHourOffset,
    );
    jest
      .useFakeTimers({
        doNotFake,
      })
      .setSystemTime(fakeDate);

    digestTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

    await con.getRepository(UserPersonalizedDigest).save(
      usersToSchedule.map((item) => ({
        userId: item.id,
        preferredDay: fakePreferredDay,
        preferredHour: fakePreferredHour,
      })),
    );

    await expectSuccessfulCron(cron);

    const scheduledPersonalizedDigests = await con
      .getRepository(UserPersonalizedDigest)
      .findBy({
        preferredDay: fakePreferredDay,
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

  it('should not schedule generation for subscriptions with other preferredDay', async () => {
    const [, ...usersToSchedule] = usersFixture;

    const fakePreferredDay = 3;
    const fakeDate = setHours(
      new Date('2024-09-11T10:32:42.680Z'),
      fakePreferredHour - digestPreferredHourOffset,
    );
    jest
      .useFakeTimers({
        doNotFake,
      })
      .setSystemTime(fakeDate);

    digestTime = format(addDays(new Date(), 2), 'yyyy-MM-dd HH:mm:ss');

    await con.getRepository(UserPersonalizedDigest).save(
      usersToSchedule.map((item) => ({
        userId: item.id,
        preferredDay: fakePreferredDay,
        preferredHour: fakePreferredHour,
      })),
    );

    await expectSuccessfulCron(cron);

    const scheduledPersonalizedDigests = await con
      .getRepository(UserPersonalizedDigest)
      .findBy({
        preferredDay: fakePreferredDay,
      });

    expect(scheduledPersonalizedDigests.length).toBeGreaterThan(0);
    expect(notifyGeneratePersonalizedDigest).toHaveBeenCalledTimes(0);
  });

  it('should log notify count', async () => {
    const [, ...usersToSchedule] = usersFixture;

    await con.getRepository(UserPersonalizedDigest).save(
      usersToSchedule.map((item) => ({
        userId: item.id,
        preferredDay,
        preferredHour: fakePreferredHour,
      })),
    );

    const infoSpy = jest.spyOn(logger, 'info');
    await expectSuccessfulCron(cron);
    expect(infoSpy).toHaveBeenCalledTimes(2);
    expect(infoSpy).toHaveBeenCalledWith(
      {
        digestCount: usersToSchedule.length,
        emailBatchId: expect.any(String),
        sendType,
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
        preferredHour: fakePreferredHour,
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
        preferredHour: fakePreferredHour,
        flags: {
          sendType,
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

  it('should schedule generation for users with timezone behind UTC', async () => {
    const fakePreferredDay = 3;
    const fakeDate = zonedTimeToUtc(
      setHours(
        new Date('2024-09-11T10:32:42.680+09:00'),
        fakePreferredHour - digestPreferredHourOffset,
      ),
      'America/Phoenix',
    );
    jest
      .useFakeTimers({
        doNotFake,
      })
      .setSystemTime(fakeDate);

    digestTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

    const usersToSchedule = usersFixture;

    await con.getRepository(UserPersonalizedDigest).save(
      usersToSchedule.map((item) => ({
        userId: item.id,
        preferredDay: fakePreferredDay,
        preferredHour: fakePreferredHour,
        flags: {
          sendType,
        },
      })),
    );
    await con.getRepository(User).save(
      usersToSchedule.map((item) => ({
        id: item.id,
        timezone: 'America/Phoenix',
      })),
    );

    await expectSuccessfulCron(cron);

    const scheduledPersonalizedDigests = await con
      .getRepository(UserPersonalizedDigest)
      .findBy({
        preferredDay: fakePreferredDay,
      });

    expect(scheduledPersonalizedDigests).toHaveLength(usersToSchedule.length);
    expect(notifyGeneratePersonalizedDigest).toHaveBeenCalledTimes(4);
  });

  it('should schedule generation for users with timezone ahead UTC', async () => {
    const fakePreferredDay = 3;
    const fakeDate = zonedTimeToUtc(
      setHours(
        new Date('2024-09-11T10:32:42.680+09:00'),
        fakePreferredHour - digestPreferredHourOffset,
      ),
      'Asia/Tokyo',
    );
    jest
      .useFakeTimers({
        doNotFake,
      })
      .setSystemTime(fakeDate);

    digestTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

    const usersToSchedule = usersFixture;

    await con.getRepository(UserPersonalizedDigest).save(
      usersToSchedule.map((item) => ({
        userId: item.id,
        preferredDay: fakePreferredDay,
        preferredHour: fakePreferredHour,
        flags: {
          sendType,
        },
      })),
    );
    await con.getRepository(User).save(
      usersToSchedule.map((item) => ({
        id: item.id,
        timezone: 'Asia/Tokyo',
      })),
    );

    await expectSuccessfulCron(cron);

    const scheduledPersonalizedDigests = await con
      .getRepository(UserPersonalizedDigest)
      .findBy({
        preferredDay: fakePreferredDay,
      });

    expect(scheduledPersonalizedDigests).toHaveLength(usersToSchedule.length);
    expect(notifyGeneratePersonalizedDigest).toHaveBeenCalledTimes(4);
  });

  it('should not schedule generation for users with prefferedHour in different timezone', async () => {
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
    await con.getRepository(User).save(
      usersToSchedule.map((item) => ({
        id: item.id,
        timezone: 'America/New_York',
      })),
    );

    await expectSuccessfulCron(cron);

    const scheduledPersonalizedDigests = await con
      .getRepository(UserPersonalizedDigest)
      .findBy({
        preferredDay,
      });

    expect(scheduledPersonalizedDigests).toHaveLength(usersToSchedule.length);
    expect(notifyGeneratePersonalizedDigest).toHaveBeenCalledTimes(0);
  });

  it('should schedule send time in the future to match hours offset', async () => {
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

    const timestampBeforeCron = startOfHour(new Date()).getTime();

    await expectSuccessfulCron(cron);

    expect(notifyGeneratePersonalizedDigest).toHaveBeenCalledTimes(
      usersToSchedule.length,
    );
    (notifyGeneratePersonalizedDigest as jest.Mock).mock.calls.forEach(
      (call) => {
        const { emailSendTimestamp } = call?.[0] || {};

        expect(emailSendTimestamp).toBeGreaterThanOrEqual(
          timestampBeforeCron + digestPreferredHourOffset * 60 * 60 * 1000,
        );
      },
    );
  });
});
