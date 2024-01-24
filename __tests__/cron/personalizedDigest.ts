import cron from '../../src/cron/personalizedDigest';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { User, UserPersonalizedDigest } from '../../src/entity';
import { usersFixture } from '../fixture/user';
import {
  createEmailBatchId,
  notifyGeneratePersonalizedDigest,
} from '../../src/common';
import pino from 'pino';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

jest.mock('../../src/common', () => ({
  ...(jest.requireActual('../../src/common') as Record<string, unknown>),
  notifyGeneratePersonalizedDigest: jest.fn(),
  createEmailBatchId: jest.fn(),
}));

describe('personalizedDigest cron', () => {
  const preferredDay = (new Date().getDay() + 1) % 7;

  beforeEach(async () => {
    jest.resetAllMocks();

    await saveFixtures(con, User, usersFixture);
    await con.getRepository(UserPersonalizedDigest).clear();

    (createEmailBatchId as jest.Mock).mockResolvedValue('test-email-batch-id');
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
      expect(notifyGeneratePersonalizedDigest).toHaveBeenCalledWith(
        expect.anything(),
        personalizedDigest,
        expect.any(Number),
        'test-email-batch-id',
      );
    });
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
      expect(notifyGeneratePersonalizedDigest).toHaveBeenCalledWith(
        expect.anything(),
        personalizedDigest,
        expect.any(Number),
        'test-email-batch-id',
      );
    });
  });

  it('should log notify count', async () => {
    const [, ...usersToSchedule] = usersFixture;

    await con.getRepository(UserPersonalizedDigest).save(
      usersToSchedule.map((item) => ({
        userId: item.id,
        preferredDay,
      })),
    );

    const logger = pino({
      messageKey: 'message',
    });
    const infoSpy = jest.spyOn(logger, 'info');
    await expectSuccessfulCron(cron, logger);
    expect(infoSpy).toHaveBeenCalledTimes(2);
    expect(infoSpy).toHaveBeenCalledWith(
      {
        digestCount: usersToSchedule.length,
        emailBatchId: 'test-email-batch-id',
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
      })),
    );

    const logger = pino({
      messageKey: 'message',
    });
    const infoSpy = jest.spyOn(logger, 'info');

    await expectSuccessfulCron(cron, logger);

    expect(infoSpy).toHaveBeenCalledTimes(2);
    expect(infoSpy).toHaveBeenCalledWith(
      { emailBatchId: 'test-email-batch-id' },
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
      })),
    );

    (createEmailBatchId as jest.Mock).mockResolvedValueOnce(undefined);

    await expect(() => {
      return expectSuccessfulCron(cron);
    }).rejects.toEqual(new Error('failed to create email batch id'));
  });
});
