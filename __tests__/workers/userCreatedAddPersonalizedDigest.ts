import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/userCreatedAddPersonalizedDigest';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { User } from '../../src/entity';
import { usersFixture } from '../fixture/user';
import { UserPersonalizedDigest } from '../../src/entity/UserPersonalizedDigest';
import { DayOfWeek } from '../../src/types';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();

  await saveFixtures(con, User, usersFixture);
});

describe('userCreatedAddPersonalizedDigest worker', () => {
  it('should subscribe user to personalized digest', async () => {
    const user = await con.getRepository(User).findOneBy({
      id: '1',
    });

    expect(user).toBeTruthy();

    await expectSuccessfulBackground(worker, {
      user: {
        ...user,
        timezone: 'Europe/Zagreb',
      },
    });

    const personalizedDigest = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: user?.id,
      });
    expect(personalizedDigest).toMatchObject({
      preferredDay: DayOfWeek.Wednesday,
      preferredHour: 8,
      preferredTimezone: 'Europe/Zagreb',
    });
  });

  it('should subscribe user to UTC timezone if not set', async () => {
    const user = await con.getRepository(User).findOneBy({
      id: '1',
    });

    expect(user).toBeTruthy();

    await expectSuccessfulBackground(worker, {
      user: {
        ...user,
        timezone: undefined,
      },
    });

    const personalizedDigest = await con
      .getRepository(UserPersonalizedDigest)
      .findOneBy({
        userId: user?.id,
      });
    expect(personalizedDigest).toMatchObject({
      preferredDay: DayOfWeek.Wednesday,
      preferredHour: 8,
      preferredTimezone: 'Etc/UTC',
    });
  });
});
