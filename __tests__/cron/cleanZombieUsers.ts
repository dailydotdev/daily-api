import cron from '../../src/cron/cleanZombieUsers';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { User } from '../../src/entity';
import { usersFixture } from '../fixture/user';
import { DataSource, Not } from 'typeorm';
import createOrGetConnection from '../../src/db';
import type { UserFlags } from '../../src/entity/user/User';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(
    con,
    User,
    usersFixture.map((u) => ({ ...u, emailConfirmed: true, flags: {} })),
  );
  // Reset inDeletion flag for all users to ensure test isolation
  await con.query(`UPDATE "user" SET flags = '{}'`);
});

describe('cleanZombieUsers', () => {
  it('should mark users with info confirmed false that are older than one hour for deletion', async () => {
    await con
      .getRepository(User)
      .update({ id: Not('1') }, { infoConfirmed: false });
    await con
      .getRepository(User)
      .update({ id: '2' }, { createdAt: new Date() });

    await expectSuccessfulCron(cron);
    const users = await con.getRepository(User).find({ order: { id: 'ASC' } });
    expect(users.length).toEqual(6);

    const markedUsers = users.filter((u) => (u.flags as UserFlags)?.inDeletion);
    expect(markedUsers.length).toEqual(4);
    expect(markedUsers.map((u) => u.id)).not.toContain('1');
    expect(markedUsers.map((u) => u.id)).not.toContain('2');
  });

  it('should mark users with email confirmed false that are older than one hour for deletion', async () => {
    await con
      .getRepository(User)
      .update({ id: Not('1') }, { infoConfirmed: true, emailConfirmed: false });
    await con
      .getRepository(User)
      .update({ id: '2' }, { createdAt: new Date() });

    await expectSuccessfulCron(cron);
    const users = await con.getRepository(User).find({ order: { id: 'ASC' } });
    expect(users.length).toEqual(6);

    const markedUsers = users.filter((u) => (u.flags as UserFlags)?.inDeletion);
    expect(markedUsers.length).toEqual(4);
    expect(markedUsers.map((u) => u.id)).not.toContain('1');
    expect(markedUsers.map((u) => u.id)).not.toContain('2');
  });

  it('should not mark users with info confirmed true and email confirmed true', async () => {
    await con
      .getRepository(User)
      .update({ id: Not('1') }, { infoConfirmed: true, emailConfirmed: true });
    await con
      .getRepository(User)
      .update({ id: '2' }, { createdAt: new Date() });

    await expectSuccessfulCron(cron);
    const users = await con.getRepository(User).find({ order: { id: 'ASC' } });
    expect(users.length).toEqual(6);

    const markedUsers = users.filter((u) => (u.flags as UserFlags)?.inDeletion);
    expect(markedUsers.length).toEqual(0);
  });
});
