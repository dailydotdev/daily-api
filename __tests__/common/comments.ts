import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { User } from '../../src/entity';
import { badUsersFixture, usersFixture } from '../fixture';
import { checkWithVordr } from '../../src/common/comments';
import { Context } from '../../src/Context';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await con.getRepository(User).save(usersFixture);
  await con.getRepository(User).save(badUsersFixture);
});

describe('commmon/comments', () => {
  describe('checkWithVordr', () => {
    it('should return true if user har vordr flag set', async () => {
      const result = await checkWithVordr('1', {
        userId: 'vordr',
        con,
      } as unknown as Context);

      expect(result).toBe(true);
    });

    it('should return true if user has trust score 0', async () => {
      const result = await checkWithVordr('1', {
        userId: 'low-score',
        con,
      } as unknown as Context);

      expect(result).toBe(true);
    });

    it('should return true if user have no negative flags', async () => {
      const result = await checkWithVordr('1', {
        userId: '1',
        con,
      } as unknown as Context);

      expect(result).toBe(false);
    });
  });
});
