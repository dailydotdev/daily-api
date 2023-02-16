import { FastifyInstance } from 'fastify';
import request from 'supertest';
import {
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
} from './helpers';
import { DataSource } from 'typeorm';
import { notifyFeaturesReset } from '../src/common';

jest.mock('../src/common', () => ({
  ...(jest.requireActual('../src/common') as Record<string, unknown>),
  notifyFeaturesReset: jest.fn(),
}));

let app: FastifyInstance;
let con: DataSource;
let state: GraphQLTestingState;

beforeAll(async () => {
  state = await initializeGraphQLTesting(() => new MockContext(con));
  app = state.app;
});

beforeEach(async () => {
  jest.resetAllMocks();
});

it('should send features reset message', async () => {
  await request(app.server).post('/flagsmith/reset?key=webhook').expect(204);
  expect(notifyFeaturesReset).toBeCalledTimes(1);
});

it('should do nothing with the wrong key', async () => {
  await request(app.server).post('/flagsmith/reset?key=a').expect(204);
  expect(notifyFeaturesReset).toBeCalledTimes(0);
});
