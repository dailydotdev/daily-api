import { User } from '../../../src/entity/user/User';
import { PersonalAccessToken } from '../../../src/entity/PersonalAccessToken';
import request from 'supertest';
import { generatePersonalAccessToken } from '../../../src/common/personalAccessToken';
import { v4 as uuidv4 } from 'uuid';
import { SubscriptionCycles } from '../../../src/paddle';
import { setupPublicApiTests, createTokenForUser } from './helpers';

const state = setupPublicApiTests();

describe('Public API Authentication', () => {
  describe('Authorization header validation', () => {
    it('should return 401 when no Authorization header is provided', async () => {
      const { body } = await request(state.app.server)
        .get('/public/v1/feeds/foryou')
        .expect(401);

      expect(body.error).toBe('unauthorized');
      expect(body.message).toContain('Missing or invalid Authorization header');
    });

    it('should return 401 when Authorization header is not Bearer type', async () => {
      const { body } = await request(state.app.server)
        .get('/public/v1/feeds/foryou')
        .set('Authorization', 'Basic some-token')
        .expect(401);

      expect(body).toMatchObject({
        error: 'unauthorized',
        message: expect.stringContaining(
          'Missing or invalid Authorization header',
        ),
      });
    });

    it('should return 401 for invalid token', async () => {
      const { body } = await request(state.app.server)
        .get('/public/v1/feeds/foryou')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(body).toMatchObject({
        error: 'invalid_token',
        message: expect.stringContaining('invalid, expired, or revoked'),
      });
    });

    it('should return 401 for revoked token', async () => {
      const { token, tokenHash, tokenPrefix } = generatePersonalAccessToken();
      await state.con.getRepository(PersonalAccessToken).save({
        id: uuidv4(),
        userId: '5',
        name: 'Revoked Token',
        tokenHash,
        tokenPrefix,
        revokedAt: new Date(),
      });

      const { body } = await request(state.app.server)
        .get('/public/v1/feeds/foryou')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(body.error).toBe('invalid_token');
    });

    it('should return 401 for expired token', async () => {
      const { token, tokenHash, tokenPrefix } = generatePersonalAccessToken();
      await state.con.getRepository(PersonalAccessToken).save({
        id: uuidv4(),
        userId: '5',
        name: 'Expired Token',
        tokenHash,
        tokenPrefix,
        expiresAt: new Date(Date.now() - 1000),
      });

      const { body } = await request(state.app.server)
        .get('/public/v1/feeds/foryou')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(body.error).toBe('invalid_token');
    });
  });

  describe('Plus subscription access', () => {
    it('should allow Plus user access', async () => {
      const token = await createTokenForUser(state.con, '5');

      await request(state.app.server)
        .get('/public/v1/feeds/foryou')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should allow access even when ENABLE_PRIVATE_ROUTES is false', async () => {
      const originalValue = process.env.ENABLE_PRIVATE_ROUTES;
      process.env.ENABLE_PRIVATE_ROUTES = 'false';

      try {
        const token = await createTokenForUser(state.con, '5');

        await request(state.app.server)
          .get('/public/v1/feeds/foryou')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
      } finally {
        process.env.ENABLE_PRIVATE_ROUTES = originalValue;
      }
    });

    it('should allow access for cancelled but still active Plus user', async () => {
      const cancelledPlusUserId = uuidv4();
      await state.con.getRepository(User).save({
        id: cancelledPlusUserId,
        name: 'Cancelled Plus User',
        username: 'cancelledplus',
        createdAt: new Date(),
        subscriptionFlags: {
          status: 'cancelled',
          cycle: SubscriptionCycles.Yearly,
        },
      });

      const token = await createTokenForUser(state.con, cancelledPlusUserId);

      await request(state.app.server)
        .get('/public/v1/feeds/foryou')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });
});
