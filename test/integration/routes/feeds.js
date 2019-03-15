import { expect } from 'chai';
import supertest from 'supertest';
import knexCleaner from 'knex-cleaner';
import db, { migrate } from '../../../src/db';
import feed from '../../../src/models/feed';
import fixturePubs from '../../fixtures/publications';
import fixture from '../../fixtures/feeds';
import app from '../../../src';
import { sign } from '../../../src/jwt';
import publication from '../../../src/models/publication';

describe('feeds routes', () => {
  let request;
  let server;

  beforeEach(async () => {
    await knexCleaner.clean(db, { ignoreTables: ['knex_migrations', 'knex_migrations_lock'] });
    await migrate();
    return Promise.all(fixturePubs.map(pub =>
      publication.add(pub.name, pub.image, pub.enabled, pub.twitter)));
  });

  before(() => {
    server = app.listen();
    request = supertest(server);
  });

  after(() => {
    server.close();
  });

  it('should throw forbidden on get publications without authorization', async () => {
    await request
      .get('/v1/feeds/publications')
      .expect(403);
  });

  it('should return the user publications', async () => {
    await feed.upsertUserPublications(fixture);
    const accessToken = await sign({ userId: fixture[0].userId });

    const { body } = await request
      .get('/v1/feeds/publications')
      .set('Authorization', `Bearer ${accessToken.token}`)
      .expect(200);

    expect(body).to.deep.equal([fixture[0], fixture[1], fixture[4]]);
  });

  it('should throw forbidden on post publications without authorization', async () => {
    await request
      .post('/v1/feeds/publications')
      .send([])
      .expect(403);
  });

  it('should update the user publications', async () => {
    const accessToken = await sign({ userId: 'user1' });

    const { body } = await request
      .post('/v1/feeds/publications')
      .set('Authorization', `Bearer ${accessToken.token}`)
      .send([fixture[0], fixture[1], fixture[4]])
      .expect(200);

    expect(body).to.deep.equal([fixture[0], fixture[1], fixture[4]]);
  });

  it('should throw forbidden on get tags without authorization', async () => {
    await request
      .get('/v1/feeds/tags')
      .expect(403);
  });

  it('should return the user tags', async () => {
    const tags = [{ tag: 'golang', userId: 'user1' }, { tag: 'javascript', userId: 'user1' }];
    await feed.addUserTags(tags);
    const accessToken = await sign({ userId: tags[0].userId });

    const { body } = await request
      .get('/v1/feeds/tags')
      .set('Authorization', `Bearer ${accessToken.token}`)
      .expect(200);

    expect(body).to.deep.equal(tags);
  });

  it('should throw forbidden on post tags without authorization', async () => {
    await request
      .post('/v1/feeds/tags')
      .send([])
      .expect(403);
  });

  it('should update the user tags', async () => {
    const tags = [{ tag: 'golang', userId: 'user1' }, { tag: 'javascript', userId: 'user1' }];
    const accessToken = await sign({ userId: 'user1' });

    const { body } = await request
      .post('/v1/feeds/tags')
      .set('Authorization', `Bearer ${accessToken.token}`)
      .send(tags)
      .expect(200);

    expect(body).to.deep.equal(tags);
  });

  it('should throw forbidden on delete tags without authorization', async () => {
    await request
      .delete('/v1/feeds/tags')
      .send({ tag: 'golang', userId: 'user1' })
      .expect(403);
  });

  it('should delete the user tag', async () => {
    const tag = { tag: 'golang', userId: 'user1' };
    const accessToken = await sign({ userId: 'user1' });

    await request
      .delete('/v1/feeds/tags')
      .set('Authorization', `Bearer ${accessToken.token}`)
      .send(tag)
      .expect(204);
  });
});
