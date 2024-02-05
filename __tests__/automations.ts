import { FastifyInstance } from 'fastify';
import appFunc from '../src';
import request from 'supertest';
import nock from 'nock';
import { authorizeRequest } from './helpers';

let app: FastifyInstance;

beforeAll(async () => {
  app = await appFunc();
  return app.ready();
});

beforeEach(async () => {
  nock.cleanAll();
});

afterAll(() => app.close());

describe('POST /auto/:name', () => {
  const auto = 'roaster';

  it('should return not found when automation does not exist', () => {
    return request(app.server).post('/auto/not').expect(404);
  });

  it('should return unauthorized when user is not logged in', () => {
    return request(app.server).post(`/auto/${auto}`).expect(401);
  });

  it('should pass params to the automation and return its response', () => {
    nock('http://localhost:7000')
      .post('/', { key: 'value', userId: '1' })
      .reply(200, { hello: 'world' });
    return authorizeRequest(
      request(app.server).post(`/auto/${auto}`).send({ key: 'value' }),
    ).expect(200, { hello: 'world' });
  });

  it('should not let the user override the user id', () => {
    nock('http://localhost:7000')
      .post('/', { userId: '1' })
      .reply(200, { hello: 'world' });
    return authorizeRequest(
      request(app.server).post(`/auto/${auto}`).send({ userId: '2' }),
    ).expect(200, { hello: 'world' });
  });

  it('should pass through the error', () => {
    nock('http://localhost:7000')
      .post('/', { userId: '1' })
      .reply(400, 'Error!');
    return authorizeRequest(
      request(app.server).post(`/auto/${auto}`).send(),
    ).expect(400, 'Error!');
  });
});
