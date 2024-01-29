import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { saveFixtures } from '../helpers';
import { usersFixture } from '../fixture/user';
import { User, UserStreak } from '../../src/entity';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
});

describe('user creation', () => {
  it('should insert streak if not exists', async () => {
    const repo = con.getRepository(UserStreak);
    const exists = await repo.findOneBy({ userId: '1' });

    expect(exists).toBeFalsy();

    await saveFixtures(con, User, usersFixture);

    const user = await con.getRepository(User).findOneBy({
      id: '1',
    });
    expect(user).toBeTruthy();

    const streak = await repo.findOneBy({ userId: user.id });
    expect(streak).toBeTruthy();
  });
});
