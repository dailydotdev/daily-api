import cron from '../../src/cron/cleanGiftedPlus';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { User } from '../../src/entity';
import { plusUsersFixture, usersFixture } from '../fixture';
import { DataSource, JsonContains } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { addDays, subDays } from 'date-fns';
import { SubscriptionCycles } from '../../src/paddle';
import { crons } from '../../src/cron/index';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(
    con,
    User,
    [...usersFixture, ...plusUsersFixture].map((user) => ({
      ...user,
      id: `${user.id}-clgp`,
    })),
  );
});

describe('cleanGiftedPlus cron', () => {
  it('should be registered', () => {
    const registeredWorker = crons.find((item) => item.name === cron.name);

    expect(registeredWorker).toBeDefined();
  });

  it('should remove expired gifted plus subscription', async () => {
    const yesterdayDate = subDays(new Date(), 1);
    const tomorrowDate = addDays(new Date(), 1);

    // 5 total users:
    // - 1-clgp is gifted and expired;
    // - 2-clgp is gifted and NOT expired;
    // - 3-clgp & 4-clgp are not plus.
    // - 5-clgp is classic yearly plus;
    await con.getRepository(User).update(
      { id: '1-clgp' },
      {
        subscriptionFlags: {
          giftExpirationDate: yesterdayDate,
          gifterId: '2-clgp',
          cycle: SubscriptionCycles.Yearly,
        },
      },
    );
    await con.getRepository(User).update(
      { id: '2-clgp' },
      {
        subscriptionFlags: {
          giftExpirationDate: tomorrowDate,
          gifterId: '3',
          cycle: SubscriptionCycles.Yearly,
        },
      },
    );

    const count = await con.getRepository(User).count({
      where: {
        subscriptionFlags: JsonContains({ cycle: SubscriptionCycles.Yearly }),
      },
    });
    // 1,2,5 are plus users
    expect(count).toEqual(3);

    await expectSuccessfulCron(cron);
    const users = await con.getRepository(User).find({
      order: { id: 'ASC' },
      select: ['subscriptionFlags', 'id'],
      where: {
        subscriptionFlags: JsonContains({ cycle: SubscriptionCycles.Yearly }),
      },
    });
    expect(users.length).toEqual(2);
    // 1 is the only removed user as it was gifted and expired
    expect(users[0].id).toEqual('2-clgp');
    expect(users[1].id).toEqual('5-clgp');
  });
});
