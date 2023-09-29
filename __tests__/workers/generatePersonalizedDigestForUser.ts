import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/generatePersonalizedDigestForUser';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { Post, Source, User } from '../../src/entity';
import { usersFixture } from '../fixture/user';
import { UserPersonalizedDigest } from '../../src/entity/UserPersonalizedDigest';
import { postsFixture } from '../fixture/post';
import { sourcesFixture } from '../fixture/source';
import { sendEmail } from '../../src/common';

jest.mock('../../src/common', () => ({
  ...(jest.requireActual('../../src/common') as Record<string, unknown>),
  sendEmail: jest.fn(),
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();

  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
  await con.getRepository(UserPersonalizedDigest).save({
    userId: '1',
  });
});

describe('generatePersonalizedDigestForUser worker', () => {
  it('should generate personalized digest for user', async () => {
    const personalizedDigest = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: '1',
      });

    expect(personalizedDigest).toBeTruthy();

    await expectSuccessfulBackground(worker, {
      personalizedDigest,
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const emailData = (sendEmail as jest.Mock).mock.calls[0][0];
    expect(emailData).toMatchSnapshot({
      sendAt: expect.any(Number),
    });
  });

  it('should generate personalized digest for user in timezone ahead UTC', async () => {
    await con.getRepository(UserPersonalizedDigest).save({
      userId: '1',
      preferredTimezone: 'America/Phoenix',
    });

    const personalizedDigest = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: '1',
      });

    expect(personalizedDigest).toBeTruthy();

    await expectSuccessfulBackground(worker, {
      personalizedDigest,
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const emailData = (sendEmail as jest.Mock).mock.calls[0][0];
    expect(emailData).toMatchSnapshot({
      sendAt: expect.any(Number),
    });
    const sentAtDate = new Date(emailData.sendAt * 1000);
    expect(sentAtDate.getDay()).toBe(personalizedDigest!.preferredDay);
    expect(sentAtDate.getHours()).toBe(personalizedDigest!.preferredHour + 7);
    expect(sentAtDate.getTimezoneOffset()).toBe(0);
  });

  it('should generate personalized digest for user in timezone behind UTC', async () => {
    await con.getRepository(UserPersonalizedDigest).save({
      userId: '1',
      preferredTimezone: 'Asia/Dhaka',
    });

    const personalizedDigest = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: '1',
      });

    expect(personalizedDigest).toBeTruthy();

    await expectSuccessfulBackground(worker, {
      personalizedDigest,
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const emailData = (sendEmail as jest.Mock).mock.calls[0][0];
    expect(emailData).toMatchSnapshot({
      sendAt: expect.any(Number),
    });
    const sentAtDate = new Date(emailData.sendAt * 1000);
    expect(sentAtDate.getDay()).toBe(personalizedDigest!.preferredDay);
    expect(sentAtDate.getHours()).toBe(personalizedDigest!.preferredHour - 6);
    expect(sentAtDate.getTimezoneOffset()).toBe(0);
  });
});
