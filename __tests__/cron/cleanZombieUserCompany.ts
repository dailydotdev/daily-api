import { cleanZombieUserCompany as cron } from '../../src/cron/cleanZombieUserCompany';
import { saveFixtures } from '../helpers';
import { expectSuccessfulCron } from '../helpers';
import { User } from '../../src/entity/user/User';
import { UserCompany } from '../../src/entity/UserCompany';
import { usersFixture } from '../fixture/user';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { subHours } from 'date-fns';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, UserCompany, [
    {
      userId: '1',
      verified: true,
      email: 'u1@com1.com',
      code: '123',
    },
  ]);
});

describe('cleanZombieUserCompany', () => {
  it('should not delete user company if the email is verified', async () => {
    await expectSuccessfulCron(cron);
    expect(
      await con.getRepository(UserCompany).findOneBy({ userId: '1' }),
    ).toBeTruthy();
  });

  it('should not delete user company if user submitted email for verification within the last hour', async () => {
    await con
      .getRepository(UserCompany)
      .update({ userId: '1' }, { verified: false });
    await expectSuccessfulCron(cron);
    expect(
      await con.getRepository(UserCompany).findOneBy({ userId: '1' }),
    ).toBeTruthy();
  });

  it('should delete user company if user submitted email for verification after one hour', async () => {
    await con
      .getRepository(UserCompany)
      .update(
        { userId: '1' },
        { verified: false, updatedAt: subHours(new Date(), 2) },
      );

    await expectSuccessfulCron(cron);
    expect(
      await con.getRepository(UserCompany).findOneBy({ userId: '1' }),
    ).toBeFalsy();
  });
});
