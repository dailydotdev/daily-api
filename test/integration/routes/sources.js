import { expect } from 'chai';
import supertest from 'supertest';
import { migrate, rollback } from '../../../src/db';
import publication from '../../../src/models/publication';
import source from '../../../src/models/source';
import fixturePubs from '../../fixtures/publications';
import fixture from '../../fixtures/sources';
import config from '../../../src/config';
import app from '../../../src';

describe('sources routes', () => {
  let request;
  let server;

  beforeEach(async () => {
    await rollback();
    await migrate();
  });

  before(() => {
    server = app.listen();
    request = supertest(server);
  });

  after(() => {
    server.close();
  });

  describe('get all endpoint', () => {
    it('should throw forbidden ', async () => {
      await request
        .get('/v1/sources')
        .expect(403);
    });

    it('should fetch all sources', async () => {
      await Promise.all(fixturePubs.map(pub => publication.add(pub.name, pub.image)));
      await Promise.all(fixture.map(s => source.add(s.publicationId, s.url)));

      const result = await request
        .get('/v1/sources')
        .set('Authorization', config.admin)
        .expect(200);

      expect(result.body).to.deep.equal(fixture);
    });
  });

  describe('add endpoint', () => {
    it('should throw forbidden ', async () => {
      await request
        .post('/v1/sources')
        .expect(403);
    });

    it('should add new source', async () => {
      await Promise.all(fixturePubs.map(pub => publication.add(pub.name, pub.image)));

      const result = await request
        .post('/v1/sources')
        .send(fixture[0])
        .set('Authorization', config.admin)
        .expect(200);

      expect(result.body).to.deep.equal(fixture[0]);
    });

    it('should send bad request when url is not valid', async () => {
      const result = await request
        .post('/v1/sources')
        .send({ publicationId: '123', url: 'rss/feed' })
        .set('Authorization', config.admin)
        .expect(400);

      expect(result.body.code).to.equal(1);
      expect(result.body.message).to.contain('"url" fails');
    });

    it('should send bad request when publication doesn\'t exist', async () => {
      const result = await request
        .post('/v1/sources')
        .send({ publicationId: '123', url: 'https://rss.com/feed' })
        .set('Authorization', config.admin)
        .expect(400);

      expect(result.body.code).to.equal(1);
      expect(result.body.message).to.contain('"publicationId" fails');
    });
  });
});
