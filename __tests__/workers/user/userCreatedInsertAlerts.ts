import { expectSuccessfulBackground, saveFixtures } from '../../helpers';
import worker from '../../../src/workers/user/userCreatedInsertAlerts';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import {Alerts, ALERTS_DEFAULT, User} from '../../../src/entity';
import { usersFixture } from '../../fixture/user';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();

  await saveFixtures(con, User, usersFixture);
});

describe('userCreatedInsertAlerts worker', () => {
  it('should insert default alerts if not exists', async () => {
    const user = await con.getRepository(User).findOneBy({
      id: '1',
    });
    expect(user).toBeTruthy();
    const repo = con.getRepository(Alerts);
    const alertsBefore = await repo.findOneBy({ userId: user.id });
    expect(alertsBefore).toBeFalsy();
    await expectSuccessfulBackground(worker, { user });
    const alertsAfter = await repo.findOneBy({ userId: user.id });
    expect(alertsAfter).toBeTruthy();
  });

  it('should do nothing if alerts exist', async () => {
    const user = await con.getRepository(User).findOneBy({
      id: '1',
    });
    expect(user).toBeTruthy();
    const repo = con.getRepository(Alerts);
    await repo.save({ ...ALERTS_DEFAULT, userId: user.id });
    await expectSuccessfulBackground(worker, { user });
    const alerts = await repo.findOneBy({ userId: user.id });
    expect(alerts).toBeTruthy();
  });
});
