import { FastifyInstance } from 'fastify';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import appFunc from '../src';
import { saveFixtures } from './helpers';
import { User, UserPersonalizedDigest } from '../src/entity';
import { usersFixture } from './fixture';
import { signJwt } from '../src/auth';
import { UnsubscribeGroup } from '../src/common';
import request from 'supertest';

let app: FastifyInstance;
let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
  app = await appFunc();
  return app.ready();
});

afterAll(() => app.close());

beforeEach(async () => {
  await saveFixtures(con, User, usersFixture);
});

describe('POST /unsubscribe', () => {
  it('should unsubscribe from notifications', async () => {
    await con
      .getRepository(User)
      .update({ id: '1' }, { notificationEmail: true });
    const token = await signJwt({
      userId: '1',
      group: UnsubscribeGroup.Notifications,
    });
    await request(app.server)
      .post('/unsubscribe')
      .query({ token: token.token })
      .expect(204);
    const user = await con.getRepository(User).findOneBy({ id: '1' });
    expect(user.notificationEmail).toBe(false);
  });

  it('should unsubscribe from digest', async () => {
    const upd1 = await con
      .getRepository(UserPersonalizedDigest)
      .findBy({ userId: '1' });
    expect(upd1.length).toBe(1);
    const token = await signJwt({
      userId: '1',
      group: UnsubscribeGroup.Digest,
    });
    await request(app.server)
      .post('/unsubscribe')
      .query({ token: token.token })
      .expect(204);
    const upd2 = await con
      .getRepository(UserPersonalizedDigest)
      .findBy({ userId: '1' });
    expect(upd2.length).toBe(0);
  });
});
