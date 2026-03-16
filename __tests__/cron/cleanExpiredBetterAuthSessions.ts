import { cleanExpiredBetterAuthSessions as cron } from '../../src/cron/cleanExpiredBetterAuthSessions';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { User } from '../../src/entity/user/User';
import { usersFixture } from '../fixture';
import { crons } from '../../src/cron/index';
import { sub, add } from 'date-fns';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.clearAllMocks();
  await saveFixtures(
    con,
    User,
    usersFixture.map((user) => ({
      ...user,
      id: `${user.id}-bac`,
      username: `${user.username}-bac`,
    })),
  );

  const now = new Date();
  await con.query(
    `INSERT INTO ba_session (id, token, "userId", "expiresAt", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $5),
            ($6, $7, $8, $9, $10, $10),
            ($11, $12, $13, $14, $15, $15)
     ON CONFLICT (id) DO NOTHING`,
    [
      'expired-1',
      'token-expired-1',
      '1-bac',
      sub(now, { days: 2 }),
      sub(now, { days: 9 }),
      'expired-2',
      'token-expired-2',
      '2-bac',
      sub(now, { hours: 1 }),
      sub(now, { days: 3 }),
      'active-1',
      'token-active-1',
      '1-bac',
      add(now, { days: 5 }),
      now,
    ],
  );
});

describe('cleanExpiredBetterAuthSessions cron', () => {
  it('should be registered', () => {
    const registeredCron = crons.find((item) => item.name === cron.name);
    expect(registeredCron).toBeDefined();
  });

  it('should delete expired sessions and keep active ones', async () => {
    const before: { id: string }[] = await con.query(
      `SELECT id FROM ba_session ORDER BY id`,
    );
    expect(before).toHaveLength(3);

    await expectSuccessfulCron(cron);

    const after: { id: string }[] = await con.query(
      `SELECT id FROM ba_session ORDER BY id`,
    );
    expect(after).toEqual([{ id: 'active-1' }]);
  });

  it('should handle no expired sessions gracefully', async () => {
    await con.query(
      `DELETE FROM ba_session WHERE id IN ('expired-1', 'expired-2')`,
    );

    await expectSuccessfulCron(cron);

    const after: { id: string }[] = await con.query(
      `SELECT id FROM ba_session WHERE id = 'active-1'`,
    );
    expect(after).toHaveLength(1);
  });
});
