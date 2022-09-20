import { Connection, getConnection, Not } from 'typeorm';

import cron from '../../src/cron/cleanZombieUsers';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { User } from '../../src/entity';
import { usersFixture } from '../fixture/user';

let con: Connection;

beforeAll(async () => {
  con = await getConnection();
});

beforeEach(async () => {
  await saveFixtures(con, User, usersFixture);
});

it('should delete users with info confirmed false that are older than one hour', async () => {
  await con
    .getRepository(User)
    .update({ id: Not('1') }, { infoConfirmed: false });
  await con.getRepository(User).update({ id: '2' }, { createdAt: new Date() });

  await expectSuccessfulCron(cron);
  const users = await con.getRepository(User).find({ order: { id: 'ASC' } });
  expect(users.length).toEqual(2);
  expect(users[0].id).toEqual('1');
  expect(users[1].id).toEqual('2');
});
