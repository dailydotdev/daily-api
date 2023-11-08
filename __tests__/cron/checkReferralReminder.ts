import cron from '../../src/cron/checkReferralReminder';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { Alerts, ALERTS_DEFAULT, User } from '../../src/entity';
import { usersFixture } from '../fixture/user';
import pino from 'pino';
import { subMonths, subWeeks } from 'date-fns';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(con, User, usersFixture);
  jest.resetAllMocks();
});

const expectAffectedRows = async (count: number) => {
  const logger = pino();
  const spy = jest.spyOn(logger, 'info');
  await expectSuccessfulCron(cron, logger);
  expect(spy).toHaveBeenLastCalledWith(
    { count },
    'finished updating referral reminders!',
  );
};

describe('newly registered users', () => {
  beforeEach(async () => {
    const repo = con.getRepository(Alerts);
    await repo.delete({ userId: '1' });
    await repo.save({
      ...ALERTS_DEFAULT,
      userId: '1',
      showGenericReferral: false,
    });
  });

  it('should not update reminder when it is already true', async () => {
    const threeWeeksAgo = subWeeks(new Date(), 3);
    await con.getRepository(User).update({}, { createdAt: threeWeeksAgo });
    await con
      .getRepository(Alerts)
      .update({ userId: '1' }, { showGenericReferral: true });
    await expectAffectedRows(0);
  });

  it('should not update reminder to true when user is less than 2 weeks', async () => {
    const oneWeeksAgo = subWeeks(new Date(), 1);
    await con.getRepository(User).update({}, { createdAt: oneWeeksAgo });
    await expectAffectedRows(0);
  });

  it('should update reminder to true when user has registered more than two weeks', async () => {
    const twoWeeksAgo = subWeeks(new Date(), 2);
    const repo = con.getRepository(Alerts);
    const alertsFalse = await repo.findOneBy({ userId: '1' });
    expect(alertsFalse.showGenericReferral).toEqual(false);
    await con.getRepository(User).update({}, { createdAt: twoWeeksAgo });
    await expectAffectedRows(1);
    const alertsTrue = await repo.findOneBy({ userId: '1' });
    expect(alertsTrue.showGenericReferral).toEqual(true);
  });
});

describe('users that have seen the reminder at least once', () => {
  beforeEach(async () => {
    const repo = con.getRepository(Alerts);
    await repo.delete({ userId: '1' });
    await repo.save({
      ...ALERTS_DEFAULT,
      userId: '1',
      showGenericReferral: false,
    });
  });

  it('should not update reminder when it is already true', async () => {
    const sevenMonthsAgo = subMonths(new Date(), 7);
    await con.getRepository(Alerts).update(
      { userId: '1' },
      {
        showGenericReferral: true,
        flags: { lastReferralReminder: sevenMonthsAgo },
      },
    );
    await expectAffectedRows(0);
  });

  it('should not update reminder to true when user has seen the popup less than 6 months', async () => {
    const fiveMonthsAgo = subMonths(new Date(), 5);
    await con
      .getRepository(Alerts)
      .update(
        { userId: '1' },
        { flags: { lastReferralReminder: fiveMonthsAgo } },
      );
    await expectAffectedRows(0);
  });

  it('should update reminder to true when user has seen the popup greater than 6 months', async () => {
    const repo = con.getRepository(Alerts);
    const alertsFalse = await repo.findOneBy({ userId: '1' });
    expect(alertsFalse.showGenericReferral).toEqual(false);
    const sixMonthsAgo = subMonths(new Date(), 6);
    await repo.update(
      { userId: '1' },
      { flags: { lastReferralReminder: sixMonthsAgo } },
    );
    await expectAffectedRows(1);
    const alertsTrue = await repo.findOneBy({ userId: '1' });
    expect(alertsTrue.showGenericReferral).toEqual(true);
  });
});
