import appFunc from '../../../src';
import { FastifyInstance } from 'fastify';
import { saveFixtures } from '../../helpers';
import {
  User,
  PersonalAccessToken,
  ArticlePost,
  Source,
} from '../../../src/entity';
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

      expect(body.error).toBe('unauthorized');
    });

    it('should return 401 for invalid token', async () => {
      const { body } = await request(app.server)
        .get('/public/v1/feed')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(body.error).toBe('invalid_token');
      expect(body.message).toContain('invalid, expired, or revoked');
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

  describe('Plus subscription validation', () => {
    it('should return 403 for non-Plus user', async () => {
      const token = await createTokenForUser('1');

      const { body } = await request(app.server)
        .get('/public/v1/feed')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(body.error).toBe('plus_required');
      expect(body.message).toContain('Plus subscription');
    });

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

describe('Public API Rate Limiting', () => {
  it('should include rate limit headers in response', async () => {
    const token = await createTokenForUser('5');

    const res = await request(app.server)
      .get('/public/v1/feed')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.headers['x-ratelimit-limit']).toBe('60');
    expect(res.headers['x-ratelimit-remaining']).toBe('59');
  });

  it('should decrement remaining rate limit with each request', async () => {
    const token = await createTokenForUser('5');

    const res1 = await request(app.server)
      .get('/public/v1/feed')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res1.headers['x-ratelimit-remaining']).toBe('59');

    const res2 = await request(app.server)
      .get('/public/v1/feed')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res2.headers['x-ratelimit-remaining']).toBe('58');
  });
});

describe('GET /public/v1/feed', () => {
  it('should return feed with posts', async () => {
    const token = await createTokenForUser('5');

    const { body } = await request(app.server)
      .get('/public/v1/feed')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.posts).toBeDefined();
    expect(Array.isArray(body.posts)).toBe(true);
    expect(body.posts.length).toBeGreaterThan(0);
  });

  it('should support pagination with limit parameter', async () => {
    const token = await createTokenForUser('5');

    const { body } = await request(app.server)
      .get('/public/v1/feed')
      .query({ limit: 2 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.posts.length).toBeLessThanOrEqual(2);
  });

  it('should support pagination with offset parameter', async () => {
    const token = await createTokenForUser('5');

    const { body: body1 } = await request(app.server)
      .get('/public/v1/feed')
      .query({ limit: 2, offset: 0 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const { body: body2 } = await request(app.server)
      .get('/public/v1/feed')
      .query({ limit: 2, offset: 2 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    if (body1.posts.length > 0 && body2.posts.length > 0) {
      expect(body1.posts[0].id).not.toBe(body2.posts[0].id);
    }
  });

  it('should include post metadata in response', async () => {
    const token = await createTokenForUser('5');

    const { body } = await request(app.server)
      .get('/public/v1/feed')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const post = body.posts[0];
    expect(post).toHaveProperty('id');
    expect(post).toHaveProperty('title');
    expect(post).toHaveProperty('url');
  });
});

describe('GET /public/v1/posts/:id', () => {
  it('should return post details for valid post ID', async () => {
    const token = await createTokenForUser('5');

    const { body } = await request(app.server)
      .get('/public/v1/posts/p1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.post).toBeDefined();
    expect(body.post.id).toBe('p1');
    expect(body.post.title).toBe('P1');
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

    expect(body.post.source).toBeDefined();
    expect(body.post.source.id).toBe('a');
  });
});
