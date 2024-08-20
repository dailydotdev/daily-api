import appFunc from '../../src';
import { FastifyInstance } from 'fastify';
import request from 'supertest';

let app: FastifyInstance;

beforeAll(async () => {
  app = await appFunc();
  return app.ready();
});

afterAll(() => app.close());

describe('POST /graphql', () => {
  it('should return vary header', async () => {
    const { headers } = await request(app.server)
      .post('/graphql')
      .send({})
      .expect(200);

    expect(headers.vary).toBe('Origin');
  });

  it('should return vary header with content-language', async () => {
    const { headers } = await request(app.server)
      .post('/graphql')
      .use((req) => {
        req.set('content-language', 'de');
      })
      .send({})
      .expect(200);

    expect(headers.vary).toBe('Origin, content-language');
  });
});
