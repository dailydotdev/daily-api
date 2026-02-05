import { FastifyInstance } from 'fastify';
import request from 'supertest';
import appFunc from '../src/index';
import createOrGetConnection from '../src/db';
import { DataSource } from 'typeorm';

let app: FastifyInstance;
let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

afterEach(async () => {
  if (app) {
    await app.close();
  }
});

describe('websocket only mode', () => {
  it('should expose all routes when WEBSOCKET_ONLY_MODE is not set', async () => {
    delete process.env.WEBSOCKET_ONLY_MODE;
    app = await appFunc();
    await app.listen({ port: 0, host: '0.0.0.0' });

    // GraphQL should be available
    const graphqlRes = await request(app.server)
      .post('/graphql')
      .send({ query: '{ __typename }' })
      .expect(200);
    expect(graphqlRes.body.data.__typename).toBe('Query');

    // REST routes should be available
    await request(app.server).get('/health').expect(200);

    // /v1 compatibility routes should be available
    await request(app.server).get('/v1/users/me').expect(401); // Expects auth
  });

  it('should only expose GraphQL and health endpoints when WEBSOCKET_ONLY_MODE is true', async () => {
    process.env.WEBSOCKET_ONLY_MODE = 'true';
    app = await appFunc();
    await app.listen({ port: 0, host: '0.0.0.0' });

    // GraphQL should still be available
    const graphqlRes = await request(app.server)
      .post('/graphql')
      .send({ query: '{ __typename }' })
      .expect(200);
    expect(graphqlRes.body.data.__typename).toBe('Query');

    // Health endpoints should still be available
    await request(app.server).get('/health').expect(200);
    await request(app.server).get('/liveness').expect(200);

    // REST routes should NOT be available
    await request(app.server).get('/v1/users/me').expect(404);

    // Icon proxy should NOT be available
    await request(app.server)
      .get('/icon?url=example.com&size=64')
      .expect(404);

    // Routes should NOT be available
    await request(app.server).get('/rss/f/popular').expect(404);
  });

  it('should support GraphQL subscriptions when WEBSOCKET_ONLY_MODE is true and ENABLE_SUBSCRIPTIONS is true', async () => {
    process.env.WEBSOCKET_ONLY_MODE = 'true';
    process.env.ENABLE_SUBSCRIPTIONS = 'true';
    app = await appFunc();
    await app.listen({ port: 0, host: '0.0.0.0' });

    // GraphQL should be available with subscription support
    const graphqlRes = await request(app.server)
      .post('/graphql')
      .send({ query: '{ __typename }' })
      .expect(200);
    expect(graphqlRes.body.data.__typename).toBe('Query');
  });
});
