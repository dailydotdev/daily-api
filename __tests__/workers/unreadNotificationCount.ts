import worker from '../../src/workers/unreadNotificationCount';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import { User } from '../../src/entity';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { usersFixture } from '../fixture/user';
import { notifyNotificationsRead } from '../../src/common';

jest.mock('../../src/common', () => ({
  ...(jest.requireActual('../../src/common') as Record<string, unknown>),
  notifyNotificationsRead: jest.fn(),
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(con, User, [usersFixture[0]]);
});

//TODO: once WT-786 is merged add more test cases
it('should notify notifications read with the updated value', async () => {
  await expectSuccessfulBackground(worker, {
    notification: { userId: '1' },
  });
  expect(notifyNotificationsRead).toBeCalledTimes(1);
  expect(jest.mocked(notifyNotificationsRead).mock.calls[0].slice(1)).toEqual([
    { unreadNotificationsCount: 0 },
  ]);
});
