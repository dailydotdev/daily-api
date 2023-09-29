import cron from '../../src/cron/personalizedDigest';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { User } from '../../src/entity';
import { usersFixture } from '../fixture/user';
import { UserPersonalizedDigest } from '../../src/entity/UserPersonalizedDigest';
import { notifyGeneratePersonalizedDigest } from '../../src/common';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(con, User, usersFixture);
  await con.getRepository(UserPersonalizedDigest).save(
    usersFixture.map((item) => ({
      userId: item.id,
    })),
  );
});

jest.mock('../../src/common', () => ({
  ...(jest.requireActual('../../src/common') as Record<string, unknown>),
  notifyGeneratePersonalizedDigest: jest.fn(),
}));

it('should schedule personalized digest generation for users', async () => {
  await expectSuccessfulCron(cron);

  const personalizedDigests = await con
    .getRepository(UserPersonalizedDigest)
    .find();

  expect(notifyGeneratePersonalizedDigest).toHaveBeenCalledTimes(
    personalizedDigests.length,
  );
  personalizedDigests.forEach((personalizedDigest) => {
    expect(notifyGeneratePersonalizedDigest).toHaveBeenCalledWith(
      expect.anything(),
      personalizedDigest,
    );
  });
});
