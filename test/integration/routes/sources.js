import { expect } from 'chai';
import supertest from 'supertest';
import { createTables, dropTables } from '../../../src/db';
import publication from '../../../src/models/publication';
import source from '../../../src/models/source';
import fixturePubs from '../../fixtures/publications';
import fixture from '../../fixtures/sources';
import app from '../../../src';

describe('sources routes', async () => {
  let request;
  let server;

  beforeEach(async () => {
    await dropTables();
    await createTables();
  });

  before(() => {
    server = app.listen();
    request = supertest(server);
  });

  after(() => {
    server.close();
  });

  it('should fetch all sources', async () => {
    await Promise.all(fixturePubs.map(pub => publication.add(pub.name, pub.image)));
    await Promise.all(fixture.map(s => source.add(s.publicationId, s.url)));

    const result = await request
      .get('/v1/sources')
      .expect(200);

    expect(result.body).to.deep.equal(fixture);
  });

  it('should add new source', async () => {
    await Promise.all(fixturePubs.map(pub => publication.add(pub.name, pub.image)));

    const result = await request
      .post('/v1/sources')
      .send(fixture[0])
      .expect(200);

    expect(result.body).to.deep.equal(fixture[0]);
  });

  it('should send bad request when url is not valid', async () => {
    const result = await request
      .post('/v1/sources')
      .send({ publicationId: '123', url: 'rss/feed' })
      .expect(400);

    expect(result.body.code).to.equal(1);
    expect(result.body.message).to.contain('"url" fails');
  });

  it('should send bad request when publication doesn\'t exist', async () => {
    const result = await request
      .post('/v1/sources')
      .send({ publicationId: '123', url: 'https://rss.com/feed' })
      .expect(400);

    expect(result.body.code).to.equal(1);
    expect(result.body.message).to.contain('"publicationId" fails');
  });
});
