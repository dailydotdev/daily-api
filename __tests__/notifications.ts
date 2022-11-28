import faker from 'faker';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
} from './helpers';
import { Banner } from '../src/entity';
import { FastifyInstance } from 'fastify';
import request from 'supertest';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';

let con: DataSource;
let state: GraphQLTestingState;
let app: FastifyInstance;
let client: GraphQLTestClient;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(() => new MockContext(con));
  app = state.app;
  client = state.client;
});

beforeEach(async () => {
  const now = new Date();
  const randomDate = (): Date => faker.date.past(null, now);
});

afterAll(() => disposeGraphQLTesting(state));

describe('query banner', () => {
  const QUERY = (lastSeen: Date): string => `{
  banner(lastSeen: "${lastSeen.toISOString()}") {
    title
    subtitle
    cta
    url
    theme
  }
}`;

  const now = new Date();

  beforeEach(() =>
    con.getRepository(Banner).save({
      timestamp: now,
      cta: 'CTA',
      subtitle: 'Subtitle',
      title: 'Title',
      theme: 'Theme',
      url: 'https://daily.dev',
    }),
  );

  it('should return the banner', async () => {
    const res = await client.query(QUERY(new Date(now.getTime() - 100000)));
    expect(res.data).toMatchSnapshot();
  });

  it('should return empty response when no relevant banner', async () => {
    const res = await client.query(QUERY(new Date(now.getTime() + 1)));
    expect(res.data).toMatchSnapshot();
  });
});

