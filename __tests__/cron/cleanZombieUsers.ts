import cron from '../../src/cron/cleanZombieUsers';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { User } from '../../src/entity';
import { usersFixture } from '../fixture/user';
import { DataSource, Not } from 'typeorm';
import createOrGetConnection from '../../src/db';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(
    con,
    User,
    usersFixture.map((u) => ({ ...u, emailConfirmed: true })),
  );
});

describe('cleanZombieUsers', () => {
  it('should delete users with info confirmed false that are older than one hour', async () => {
    await con
      .getRepository(User)
      .update({ id: Not('1') }, { infoConfirmed: false });
    await con
      .getRepository(User)
      .update({ id: '2' }, { createdAt: new Date() });

    await expectSuccessfulCron(cron);
    const users = await con.getRepository(User).find({ order: { id: 'ASC' } });
    expect(users.length).toEqual(3);
    expect(users[0].id).toEqual('1');
    expect(users[1].id).toEqual('2');
  });

  it('should delete users with email confirmed false that are older than one hour', async () => {
    await con
      .getRepository(User)
      .update({ id: Not('1') }, { infoConfirmed: true, emailConfirmed: false });
    await con
      .getRepository(User)
      .update({ id: '2' }, { createdAt: new Date() });

    await expectSuccessfulCron(cron);
    const users = await con.getRepository(User).find({ order: { id: 'ASC' } });
    expect(users.length).toEqual(3);
    expect(users[0].id).toEqual('1');
    expect(users[1].id).toEqual('2');
  });

  it('should not delete users with info confirmed true and email confirmed true', async () => {
    await con
      .getRepository(User)
      .update({ id: Not('1') }, { infoConfirmed: true, emailConfirmed: true });
    await con
      .getRepository(User)
      .update({ id: '2' }, { createdAt: new Date() });

    await expectSuccessfulCron(cron);
    const users = await con.getRepository(User).find({ order: { id: 'ASC' } });
    expect(users.length).toEqual(5);
    expect(users[0].id).toEqual('1');
    expect(users[1].id).toEqual('2');
  });
});
