import * as argon2 from 'argon2';
import * as bcryptjs from 'bcryptjs';
import { verifyPasswordWithBcryptFallback } from '../../src/betterAuth';

const TEST_PASSWORD = 'testPassword123';

describe('verifyPasswordWithBcryptFallback', () => {
  it('should verify an Argon2id hash', async () => {
    const hash = await argon2.hash(TEST_PASSWORD, { type: argon2.argon2id });

    const result = await verifyPasswordWithBcryptFallback({
      hash,
      password: TEST_PASSWORD,
    });

    expect(result).toBe(true);
  });

  it('should reject wrong password for Argon2id hash', async () => {
    const hash = await argon2.hash(TEST_PASSWORD, { type: argon2.argon2id });

    const result = await verifyPasswordWithBcryptFallback({
      hash,
      password: 'wrongPassword',
    });

    expect(result).toBe(false);
  });

  it('should verify a BCrypt hash', async () => {
    const hash = bcryptjs.hashSync(TEST_PASSWORD, 8);

    const result = await verifyPasswordWithBcryptFallback({
      hash,
      password: TEST_PASSWORD,
    });

    expect(result).toBe(true);
  });

  it('should reject wrong password for BCrypt hash', async () => {
    const hash = bcryptjs.hashSync(TEST_PASSWORD, 8);

    const result = await verifyPasswordWithBcryptFallback({
      hash,
      password: 'wrongPassword',
    });

    expect(result).toBe(false);
  });

  it('should rehash BCrypt to Argon2id when pool is provided', async () => {
    const hash = bcryptjs.hashSync(TEST_PASSWORD, 8);
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rowCount: 1 }),
    };

    const result = await verifyPasswordWithBcryptFallback({
      hash,
      password: TEST_PASSWORD,
      pool: mockPool as never,
    });

    expect(result).toBe(true);
    expect(mockPool.query).toHaveBeenCalledTimes(1);

    const [sql, params] = mockPool.query.mock.calls[0] as [
      string,
      [string, string],
    ];
    expect(sql).toContain('UPDATE ba_account');
    expect(params[1]).toBe(hash);
    expect(params[0]).toMatch(/^\$argon2id\$/);
  });

  it('should not attempt rehash when pool is not provided', async () => {
    const hash = bcryptjs.hashSync(TEST_PASSWORD, 8);

    const result = await verifyPasswordWithBcryptFallback({
      hash,
      password: TEST_PASSWORD,
    });

    expect(result).toBe(true);
  });

  it('should still return true if rehash fails', async () => {
    const hash = bcryptjs.hashSync(TEST_PASSWORD, 8);
    const mockPool = {
      query: jest.fn().mockRejectedValue(new Error('DB error')),
    };

    const result = await verifyPasswordWithBcryptFallback({
      hash,
      password: TEST_PASSWORD,
      pool: mockPool as never,
    });

    expect(result).toBe(true);
  });
});
