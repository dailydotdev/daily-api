import _ from 'lodash';
import { expect } from 'chai';
import supertest from 'supertest';
import nock from 'nock';
import knexCleaner from 'knex-cleaner';
import db, { migrate } from '../../../src/db';
import publication from '../../../src/models/publication';
import fixture from '../../fixtures/publications';
import reqFixture from '../../fixtures/pubsRequests';
import app from '../../../src';
import config from '../../../src/config';
import pubsRequest from '../../../src/models/pubsRequest';

describe('publications routes', () => {
  let request;
  let server;

  beforeEach(async () => {
    await knexCleaner.clean(db, { ignoreTables: ['knex_migrations', 'knex_migrations_lock'] });
    await migrate();
    return Promise.all(fixture.map(pub =>
      publication.add(pub.name, pub.image, pub.enabled, pub.twitter)));
  });

  before(() => {
    server = app.listen();
    request = supertest(server);
  });

  after(() => {
    server.close();
  });

  it('should fetch enabled publications', async () => {
    const result = await request
      .get('/v1/publications')
      .expect(200);

    expect(result.body).to.deep.equal([fixture[0], fixture[1]]);
  });

  it('should add new pub request', async () => {
    nock(config.gatewayUrl)
      .get('/v1/users/me/info')
      .reply(200, { email: 'ido@dailynow.co', name: 'Ido' });

    await request
      .post('/v1/publications/requests')
      .set('Authorization', `Service ${config.accessSecret}`)
      .set('User-Id', '1')
      .set('Logged-In', true)
      .send({ source: 'https://www.dailynow.co' })
      .expect(204);

    const models = (await pubsRequest.getOpenRequests()).map(x => _.omit(x, ['id', 'createdAt']));
    expect(models).to.deep.equal([{
      url: 'https://www.dailynow.co',
      userId: '1',
      approved: null,
      reason: null,
      userEmail: 'ido@dailynow.co',
      userName: 'Ido',
      pubId: null,
      pubImage: null,
      pubName: null,
      pubRss: null,
      pubTwitter: null,
      closed: false,
    }]);
  });

  it('should not allow non-moderators access open requests', async () => {
    nock(config.gatewayUrl)
      .get('/v1/users/me/roles')
      .reply(200, ['viewer']);

    await request
      .get('/v1/publications/requests/open')
      .set('Authorization', `Service ${config.accessSecret}`)
      .set('User-Id', '1')
      .set('Logged-In', true)
      .expect(403);
  });

  it('should fetch open requests', async () => {
    await Promise.all(reqFixture.input.map(pubsRequest.add));

    nock(config.gatewayUrl)
      .get('/v1/users/me/roles')
      .reply(200, ['moderator']);

    const result = await request
      .get('/v1/publications/requests/open')
      .set('Authorization', `Service ${config.accessSecret}`)
      .set('User-Id', '1')
      .set('Logged-In', true)
      .expect(200);

    const actual = result.body.map(x => _.omit(x, ['id', 'createdAt']));
    expect(actual).to.deep.equal([reqFixture.output[0], reqFixture.output[3]]);
  });

  it('should not allow non-moderators update a request', async () => {
    nock(config.gatewayUrl)
      .get('/v1/users/me/roles')
      .reply(200, ['viewer']);

    await request
      .put('/v1/publications/requests/1')
      .set('Authorization', `Service ${config.accessSecret}`)
      .set('User-Id', '1')
      .set('Logged-In', true)
      .expect(403);
  });

  it('should not allow update a non existing request', async () => {
    nock(config.gatewayUrl)
      .get('/v1/users/me/roles')
      .reply(200, ['moderator']);

    await request
      .put('/v1/publications/requests/1')
      .set('Authorization', `Service ${config.accessSecret}`)
      .set('User-Id', '1')
      .set('Logged-In', true)
      .send({ pubId: 'id' })
      .expect(403);
  });

  it('should update an existing request', async () => {
    await Promise.all(reqFixture.input.map(pubsRequest.add));
    const models = (await pubsRequest.getOpenRequests());
    const { id } = models[0];

    nock(config.gatewayUrl)
      .get('/v1/users/me/roles')
      .reply(200, ['moderator']);

    await request
      .put(`/v1/publications/requests/${id}`)
      .set('Authorization', `Service ${config.accessSecret}`)
      .set('User-Id', '1')
      .set('Logged-In', true)
      .send({ pubId: 'id' })
      .expect(204);

    const actual = (await pubsRequest.getOpenRequests()).map(x => _.omit(x, ['id', 'createdAt']));
    expect(actual).to.deep.equal([
      Object.assign({}, reqFixture.output[0], { pubId: 'id' }),
      reqFixture.output[3],
    ]);
  });

  it('should not allow non-moderators approve a request', async () => {
    nock(config.gatewayUrl)
      .get('/v1/users/me/roles')
      .reply(200, ['viewer']);

    await request
      .post('/v1/publications/requests/1/approve')
      .set('Authorization', `Service ${config.accessSecret}`)
      .set('User-Id', '1')
      .set('Logged-In', true)
      .expect(403);
  });

  it('should not allow approve a non existing request', async () => {
    nock(config.gatewayUrl)
      .get('/v1/users/me/roles')
      .reply(200, ['moderator']);

    await request
      .post('/v1/publications/requests/1/approve')
      .set('Authorization', `Service ${config.accessSecret}`)
      .set('User-Id', '1')
      .set('Logged-In', true)
      .expect(403);
  });

  it('should approve an existing request', async () => {
    await pubsRequest.add(reqFixture.input[0]);
    const models = (await pubsRequest.getOpenRequests());
    const { id } = models[0];

    nock(config.gatewayUrl)
      .get('/v1/users/me/roles')
      .reply(200, ['moderator']);

    await request
      .post(`/v1/publications/requests/${id}/approve`)
      .set('Authorization', `Service ${config.accessSecret}`)
      .set('User-Id', '1')
      .set('Logged-In', true)
      .expect(204);

    const actual = (await pubsRequest.getOpenRequests()).map(x => _.omit(x, ['id', 'createdAt']));
    expect(actual).to.deep.equal([
      Object.assign({}, reqFixture.output[0], { approved: true }),
    ]);
  });

  it('should not allow non-moderators decline a request', async () => {
    nock(config.gatewayUrl)
      .get('/v1/users/me/roles')
      .reply(200, ['viewer']);

    await request
      .post('/v1/publications/requests/1/decline')
      .set('Authorization', `Service ${config.accessSecret}`)
      .set('User-Id', '1')
      .set('Logged-In', true)
      .expect(403);
  });

  it('should not allow declining a non existing request', async () => {
    nock(config.gatewayUrl)
      .get('/v1/users/me/roles')
      .reply(200, ['moderator']);

    await request
      .post('/v1/publications/requests/1/decline')
      .set('Authorization', `Service ${config.accessSecret}`)
      .set('User-Id', '1')
      .set('Logged-In', true)
      .expect(403);
  });

  it('should decline an existing request', async () => {
    await pubsRequest.add(reqFixture.input[0]);
    const models = (await pubsRequest.getOpenRequests());
    const { id } = models[0];

    nock(config.gatewayUrl)
      .get('/v1/users/me/roles')
      .reply(200, ['moderator']);

    await request
      .post(`/v1/publications/requests/${id}/decline`)
      .set('Authorization', `Service ${config.accessSecret}`)
      .set('User-Id', '1')
      .set('Logged-In', true)
      .send({ reason: 'exists' })
      .expect(204);

    const actual = _.omit(await pubsRequest.getById(1), ['id', 'createdAt']);
    expect(actual).to.deep.equal(Object.assign(
      {}, reqFixture.output[0],
      { approved: false, reason: 'exists', closed: true },
    ));
  });

  it('should not allow non-moderators publish a request', async () => {
    nock(config.gatewayUrl)
      .get('/v1/users/me/roles')
      .reply(200, ['viewer']);

    await request
      .post('/v1/publications/requests/1/publish')
      .set('Authorization', `Service ${config.accessSecret}`)
      .set('User-Id', '1')
      .set('Logged-In', true)
      .expect(403);
  });

  it('should not allow publishing a non existing request', async () => {
    nock(config.gatewayUrl)
      .get('/v1/users/me/roles')
      .reply(200, ['moderator']);

    await request
      .post('/v1/publications/requests/1/publish')
      .set('Authorization', `Service ${config.accessSecret}`)
      .set('User-Id', '1')
      .set('Logged-In', true)
      .expect(403);
  });

  it('should not allow publishing a partial request', async () => {
    await pubsRequest.add({
      url: 'https://www.dailynow.co',
      userId: '123980',
      approved: true,
    });

    const models = (await pubsRequest.getOpenRequests());
    const { id } = models[0];

    nock(config.gatewayUrl)
      .get('/v1/users/me/roles')
      .reply(200, ['moderator']);

    await request
      .post(`/v1/publications/requests/${id}/publish`)
      .set('Authorization', `Service ${config.accessSecret}`)
      .set('User-Id', '1')
      .set('Logged-In', true)
      .expect(403);
  });

  it('should publish an existing request', async () => {
    config.superfeedr = { user: 'user', pass: 'pass' };

    await pubsRequest.add({
      url: 'https://www.dailynow.co',
      userId: '123980',
      approved: true,
      pubId: 'id',
      pubName: 'name',
      pubImage: 'https://pic.com',
      pubRss: 'https://rss.com',
    });
    const models = (await pubsRequest.getOpenRequests());
    const { id } = models[0];

    nock(config.gatewayUrl)
      .get('/v1/users/me/roles')
      .reply(200, ['moderator']);

    nock('https://push.superfeedr.com/')
      .post('/')
      .reply(200);

    await request
      .post(`/v1/publications/requests/${id}/publish`)
      .set('Authorization', `Service ${config.accessSecret}`)
      .set('User-Id', '1')
      .set('Logged-In', true)
      .expect(204);

    const req = await pubsRequest.getById(id);
    expect(req.closed).to.deep.equal(true);

    const pubs = await publication.getEnabled();
    const pub = pubs.filter(p => p.id === 'id')[0];
    expect(pub).to.deep.equal({
      id: 'id', name: 'name', image: 'https://pic.com', enabled: true, twitter: null,
    });
  });
});
