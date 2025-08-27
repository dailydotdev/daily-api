import appFunc from '../../../src';
import { FastifyInstance } from 'fastify';
import request from 'supertest';

import type { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { Post, Source, SourceMember, User } from '../../../src/entity';
import { SourceMemberRoles } from '../../../src/roles';
import { randomUUID } from 'node:crypto';
import { authorizeRequest, saveFixtures } from '../../helpers';
import { usersFixture } from '../../fixture/user';

let app: FastifyInstance;
let con: DataSource;

beforeAll(async () => {
  app = await appFunc();
  con = await createOrGetConnection();
  return app.ready();
});

afterAll(() => app.close());

beforeEach(async () => {
  jest.resetAllMocks();
});

describe('POST /p/kvasir/posts', () => {
  const postIds = ['p1', 'p2', 'p3', 'p4'];
  const userId = '1';

  beforeEach(async () => {
    await con.getRepository(Source).save([
      { id: 's1', handle: 's1', name: 'Public Source', private: false },
      { id: 's2', handle: 's2', name: 'Private Source', private: true },
    ]);

    await con.getRepository(Post).save([
      {
        id: 'p1',
        title: 'Public post',
        sourceId: 's1',
        deleted: false,
        visible: true,
        shortId: 'sh1',
      },
      {
        id: 'p2',
        title: 'Private post',
        sourceId: 's2',
        deleted: false,
        visible: true,
        shortId: 'sh2',
      },
      {
        id: 'p3',
        title: 'Deleted post',
        sourceId: 's1',
        deleted: true,
        visible: true,
        shortId: 'sh3',
      },
      {
        id: 'p4',
        title: 'Invisible post',
        sourceId: 's1',
        deleted: false,
        visible: false,
        shortId: 'sh4',
      },
    ]);

    await saveFixtures(con, User, usersFixture);

    await con.getRepository(SourceMember).save([
      {
        sourceId: 's2',
        userId,
        role: SourceMemberRoles.Member,
        referralToken: randomUUID(),
      },
    ]);
  });

  it('should require service token', async () => {
    const res = await request(app.server)
      .post('/p/kvasir/posts')
      .send({ postIds });

    expect(res.statusCode).toEqual(404);
    expect(res.body).toMatchObject({});
  });

  it('should require authentication', async () => {
    const res = await request(app.server)
      .post('/p/kvasir/posts')
      .send({ postIds })
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`);

    expect(res.statusCode).toEqual(401);
    expect(res.body).toMatchObject({ error: 'Unauthorized' });
  });

  it('should validate input has postIds', async () => {
    const res = await authorizeRequest(
      request(app.server).post('/p/kvasir/posts').send({ invalid: 'data' }),
    );

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toHaveProperty('name', 'ZodError');
  });

  it('should validate postIds is not empty', async () => {
    const res = await authorizeRequest(
      request(app.server).post('/p/kvasir/posts').send({ postIds: [] }),
    );

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toHaveProperty('name', 'ZodError');
  });

  it('should validate postIds does not exceed maximum length', async () => {
    const longPostIds = Array.from({ length: 101 }, (_, i) => `p${i + 1}`);

    const res = await authorizeRequest(
      request(app.server)
        .post('/p/kvasir/posts')
        .send({ postIds: longPostIds }),
    );

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toHaveProperty('name', 'ZodError');
    expect(res.body.error.issues[0]).toMatchObject({
      code: 'too_big',
      maximum: 100,
      origin: 'array',
    });
  });

  it('should return public posts', async () => {
    const res = await authorizeRequest(
      request(app.server).post('/p/kvasir/posts').send({ postIds }),

      '2',
    );

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toEqual('p1');
  });

  it('should return private posts when user is a member', async () => {
    const res = await authorizeRequest(
      request(app.server)
        .post('/p/kvasir/posts')
        .send({ postIds: ['p2'] }),
    );

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toEqual('p2');
  });

  it('should not return private posts when user is blocked', async () => {
    await con
      .getRepository(SourceMember)
      .update({ sourceId: 's2', userId }, { role: SourceMemberRoles.Blocked });

    const res = await authorizeRequest(
      request(app.server)
        .post('/p/kvasir/posts')
        .send({ postIds: ['p2'] }),
    );

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveLength(0);
  });

  it('should not return deleted or invisible posts', async () => {
    const res = await authorizeRequest(
      request(app.server)
        .post('/p/kvasir/posts')
        .send({ postIds: ['p3', 'p4'] }),
    );

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveLength(0);
  });
});
