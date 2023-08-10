import request from 'supertest';
import {
  authorizeRequest,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
} from '../helpers';
import { DataSource } from 'typeorm';
import { FastifyInstance } from 'fastify';
import createOrGetConnection from '../../src/db';
import nock from 'nock';
import { FeedbackArgs } from '../../src/routes/search';

let con: DataSource;
let app: FastifyInstance;
let state: GraphQLTestingState;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(() => new MockContext(con, null));
  app = state.app;
});

describe('POST /search/feedback', () => {
  const BASE_PATH = '/search/feedback';
  const chunkId = 'chunk';

  const mockFeedback = (params: FeedbackArgs) => {
    nock(process.env.MAGNI_ORIGIN)
      .post('/feedback')
      .matchHeader('Content-Type', 'application/json')
      .reply(204, params);
  };

  it('should not authorize when not logged in', async () => {
    await request(app.server).post(BASE_PATH).expect(401);
  });

  it('should throw validation error when value is greater than 1', async () => {
    await authorizeRequest(
      request(app.server)
        .post(BASE_PATH)
        .send({ value: 2, chunkId })
        .expect(400),
    );
  });

  it('should throw validation error when value is less than -1', async () => {
    await authorizeRequest(
      request(app.server)
        .post(BASE_PATH)
        .send({ value: -2, chunkId })
        .expect(400),
    );
  });

  it('should throw validation error when chunk id is missing', async () => {
    await authorizeRequest(
      request(app.server).post(BASE_PATH).send({ value: 1 }).expect(400),
    );
  });

  it('should send feedback to magni if all values are valid', async () => {
    mockFeedback({ value: 1, chunkId });
    await authorizeRequest(
      request(app.server)
        .post(BASE_PATH)
        .send({ value: 1, chunkId })
        .expect(200),
    );
  });
});
