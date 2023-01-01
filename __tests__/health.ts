import request from 'supertest';

import appFunc from '../src';
import { FastifyInstance } from 'fastify';

describe('health check', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await appFunc();
    return app.ready();
  });

  afterAll(() => app.close());

  it('should return status code 200 for readiness probe', () =>
    request(app.server)
      .get('/health')
      .expect('content-type', 'application/health+json; charset=utf-8')
      .expect(200, { status: 'ok' }));

  it('should return status code 200 for liveness probe', () =>
    request(app.server)
      .get('/liveness')
      .expect('content-type', 'application/health+json; charset=utf-8')
      .expect(200, { status: 'ok' }));
});
