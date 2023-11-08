import cron from '../../src/cron/checkReferralReminder';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { DataSource, Repository } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { Alerts, ALERTS_DEFAULT, User } from '../../src/entity';
import { usersFixture } from '../fixture/user';
import { subMonths, subWeeks } from 'date-fns';

let con: DataSource;
let repo: Repository<Alerts>;
beforeAll(async () => {
  con = await createOrGetConnection();
  repo = con.getRepository(Alerts);
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, User, usersFixture);
  await repo.delete({ userId: '1' });
  await repo.save({
    ...ALERTS_DEFAULT,
    userId: '1',
    showGenericReferral: false,
  });
});

const expectReferralValue = async (before: boolean, after: boolean) => {
  const alertsBefore = await repo.findOneBy({ userId: '1' });
  expect(alertsBefore.showGenericReferral).toEqual(before);
  await expectSuccessfulCron(cron);
  const alertsAfter = await repo.findOneBy({ userId: '1' });
  expect(alertsAfter.showGenericReferral).toEqual(after);
};

describe('newly registered users', () => {
  it('should not update reminder when it is already true', async () => {
    const threeWeeksAgo = subWeeks(new Date(), 3);
    await con.getRepository(User).update({}, { createdAt: threeWeeksAgo });
    await repo.update({ userId: '1' }, { showGenericReferral: true });
    await expectReferralValue(true, true);
  });

  it('should not update reminder to true when user is less than 2 weeks', async () => {
    const oneWeeksAgo = subWeeks(new Date(), 1);
    await con.getRepository(User).update({}, { createdAt: oneWeeksAgo });
    await expectReferralValue(false, false);
  });

  it('should update reminder to true when user has registered more than two weeks', async () => {
    const twoWeeksAgo = subWeeks(new Date(), 2);
    await con.getRepository(User).update({}, { createdAt: twoWeeksAgo });
    await expectReferralValue(false, true);
  });
});

describe('users that have seen the reminder at least once', () => {
  it('should not update reminder when it is already true', async () => {
    const sevenMonthsAgo = subMonths(new Date(), 7);
    await con.getRepository(Alerts).update(
      { userId: '1' },
      {
        showGenericReferral: true,
        flags: { lastReferralReminder: sevenMonthsAgo },
      },
    );
    await expectReferralValue(true, true);
  });

  it('should not update reminder to true when user has seen the popup less than 6 months', async () => {
    const fiveMonthsAgo = subMonths(new Date(), 5);
    await con
      .getRepository(Alerts)
      .update(
        { userId: '1' },
        { flags: { lastReferralReminder: fiveMonthsAgo } },
      );
    await expectReferralValue(false, false);
  });

  it('should update reminder to true when user has seen the popup greater than 6 months', async () => {
    const sixMonthsAgo = subMonths(new Date(), 6);
    await repo.update(
      { userId: '1' },
      { flags: { lastReferralReminder: sixMonthsAgo } },
    );
    await expectReferralValue(false, true);
  });
});
