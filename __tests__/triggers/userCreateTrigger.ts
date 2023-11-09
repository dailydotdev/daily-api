import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { usersFixture } from '../fixture/user';
import { saveFixtures } from '../helpers';
import { Alerts, User } from '../../src/entity';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
});

describe('user_create_alerts_trigger after insert trigger', () => {
  it('should insert default alerts', async () => {
    const repo = con.getRepository(Alerts);
    const [user] = usersFixture;
    const alertsBefore = await repo.findOneBy({ userId: user.id });
    expect(alertsBefore).toBeFalsy();
    await saveFixtures(con, User, [user]);
    const alertsAfter = await repo.findOneBy({ userId: user.id });
    expect(alertsAfter).toBeTruthy();
  });
});
