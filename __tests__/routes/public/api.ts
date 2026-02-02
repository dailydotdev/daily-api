import appFunc from '../../../src';
import { FastifyInstance } from 'fastify';
import { saveFixtures } from '../../helpers';
import { User } from '../../../src/entity/user/User';
import { PersonalAccessToken } from '../../../src/entity/PersonalAccessToken';
import { ArticlePost } from '../../../src/entity/posts/ArticlePost';
import { Source } from '../../../src/entity/Source';
import { usersFixture, plusUsersFixture } from '../../fixture/user';
import { sourcesFixture } from '../../fixture/source';
import { postsFixture } from '../../fixture/post';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import request from 'supertest';
import { generatePersonalAccessToken } from '../../../src/common/personalAccessToken';
import { v4 as uuidv4 } from 'uuid';
import { ioRedisPool } from '../../../src/redis';
import { SubscriptionCycles } from '../../../src/paddle';

let app: FastifyInstance;
let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
  app = await appFunc();
  return app.ready();
});

afterAll(() => app.close());

beforeEach(async () => {
  jest.resetAllMocks();
  await ioRedisPool.execute((client) => client.flushall());
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, User, plusUsersFixture);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
});

const createTokenForUser = async (userId: string) => {
  const { token, tokenHash, tokenPrefix } = generatePersonalAccessToken();
  await con.getRepository(PersonalAccessToken).save({
    id: uuidv4(),
    userId,
    name: 'Test Token',
    tokenHash,
    tokenPrefix,
  });
  return token;
};

/**
 * Authentication Tests
 */
describe('Public API Authentication', () => {
  describe('Authorization header validation', () => {
    it('should return 401 when no Authorization header is provided', async () => {
      const { body } = await request(app.server)
        .get('/public/v1/feed')
        .expect(401);

      expect(body.error).toBe('unauthorized');
      expect(body.message).toContain('Missing or invalid Authorization header');
    });

    it('should return 401 when Authorization header is not Bearer type', async () => {
      const { body } = await request(app.server)
        .get('/public/v1/feed')
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
      const { body } = await request(app.server)
        .get('/public/v1/feed')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(body).toMatchObject({
        error: 'invalid_token',
        message: expect.stringContaining('invalid, expired, or revoked'),
      });
    });

    it('should return 401 for revoked token', async () => {
      const { token, tokenHash, tokenPrefix } = generatePersonalAccessToken();
      await con.getRepository(PersonalAccessToken).save({
        id: uuidv4(),
        userId: '5',
        name: 'Revoked Token',
        tokenHash,
        tokenPrefix,
        revokedAt: new Date(),
      });

      const { body } = await request(app.server)
        .get('/public/v1/feed')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(body.error).toBe('invalid_token');
    });

    it('should return 401 for expired token', async () => {
      const { token, tokenHash, tokenPrefix } = generatePersonalAccessToken();
      await con.getRepository(PersonalAccessToken).save({
        id: uuidv4(),
        userId: '5',
        name: 'Expired Token',
        tokenHash,
        tokenPrefix,
        expiresAt: new Date(Date.now() - 1000),
      });

      const { body } = await request(app.server)
        .get('/public/v1/feed')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(body.error).toBe('invalid_token');
    });
  });

  describe('Plus subscription access', () => {
    it('should allow Plus user access', async () => {
      const token = await createTokenForUser('5');

      await request(app.server)
        .get('/public/v1/feed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should allow access for cancelled but still active Plus user', async () => {
      const cancelledPlusUserId = uuidv4();
      await con.getRepository(User).save({
        id: cancelledPlusUserId,
        name: 'Cancelled Plus User',
        username: 'cancelledplus',
        createdAt: new Date(),
        subscriptionFlags: {
          status: 'cancelled',
          cycle: SubscriptionCycles.Yearly,
        },
      });

      const token = await createTokenForUser(cancelledPlusUserId);

      await request(app.server)
        .get('/public/v1/feed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });
});

/**
 * Rate Limiting Tests
 */
describe('Public API Rate Limiting', () => {
  it('should include rate limit headers in response', async () => {
    const token = await createTokenForUser('5');

    const res = await request(app.server)
      .get('/public/v1/feed')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
  });

  it('should decrement remaining rate limit with each request', async () => {
    const token = await createTokenForUser('5');

    const res1 = await request(app.server)
      .get('/public/v1/feed')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const remaining1 = parseInt(res1.headers['x-ratelimit-remaining'], 10);

    const res2 = await request(app.server)
      .get('/public/v1/feed')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const remaining2 = parseInt(res2.headers['x-ratelimit-remaining'], 10);

    expect(remaining2).toBeLessThan(remaining1);
  });
});

/**
 * Feed Endpoint Tests
 */
describe('GET /public/v1/feed', () => {
  it('should return feed with posts', async () => {
    const token = await createTokenForUser('5');

    const { body } = await request(app.server)
      .get('/public/v1/feed')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.pagination).toMatchObject({
      hasNextPage: expect.any(Boolean),
    });
  });

  it('should support pagination with limit parameter', async () => {
    const token = await createTokenForUser('5');

    const { body } = await request(app.server)
      .get('/public/v1/feed')
      .query({ limit: 2 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data.length).toBeLessThanOrEqual(2);
  });

  it('should support cursor-based pagination', async () => {
    const token = await createTokenForUser('5');

    const { body: body1 } = await request(app.server)
      .get('/public/v1/feed')
      .query({ limit: 2 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    if (body1.pagination.cursor) {
      const { body: body2 } = await request(app.server)
        .get('/public/v1/feed')
        .query({ limit: 2, cursor: body1.pagination.cursor })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      if (body1.data.length > 0 && body2.data.length > 0) {
        expect(body1.data[0].id).not.toBe(body2.data[0].id);
      }
    }
  });

  it('should include post metadata in response', async () => {
    const token = await createTokenForUser('5');

    const { body } = await request(app.server)
      .get('/public/v1/feed')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const post = body.data[0];
    expect(post).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
    });
  });
});

/**
 * Posts Endpoint Tests
 */
describe('GET /public/v1/posts/:id', () => {
  it('should return post details for valid post ID', async () => {
    const token = await createTokenForUser('5');

    const { body } = await request(app.server)
      .get('/public/v1/posts/p1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data).toMatchObject({
      id: 'p1',
      title: 'P1',
    });
  });

  it('should return 404 for non-existent post', async () => {
    const token = await createTokenForUser('5');

    const { body } = await request(app.server)
      .get('/public/v1/posts/non-existent-post')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(body.error).toBe('not_found');
  });

  it('should include source information in response', async () => {
    const token = await createTokenForUser('5');

    const { body } = await request(app.server)
      .get('/public/v1/posts/p1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data.source).toMatchObject({ id: 'a' });
  });

  it('should include bookmarked field in response', async () => {
    const token = await createTokenForUser('5');

    const { body } = await request(app.server)
      .get('/public/v1/posts/p1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data).toMatchObject({
      bookmarked: expect.any(Boolean),
    });
  });
});
