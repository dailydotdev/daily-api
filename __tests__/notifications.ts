import faker from 'faker';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
} from './helpers';
import { Banner, Notification } from '../src/entity';
import { FastifyInstance } from 'fastify';
import request from 'supertest';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';

let con: DataSource;
let state: GraphQLTestingState;
let app: FastifyInstance;
let client: GraphQLTestClient;
let notifications: Notification[];

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(() => new MockContext(con));
  app = state.app;
  client = state.client;
});

beforeEach(async () => {
  const now = new Date();
  const randomDate = (): Date => faker.date.past(null, now);
  notifications = Array.from(Array(8))
    .map(() => new Notification(randomDate(), faker.random.words(5)))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  await con.getRepository(Notification).save(notifications);
});

afterAll(() => disposeGraphQLTesting(state));

describe('query latestNotifications', () => {
  const QUERY = `{
  latestNotifications {
    timestamp
    html
  }
}`;

  it('should return the newest notifications', async () => {
    const expected = notifications
      .slice(0, 5)
      .map((n) => ({ html: n.html, timestamp: n.timestamp.toISOString() }));

    const res = await client.query(QUERY);
    expect(res.data.latestNotifications).toEqual(expected);
  });
});

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

describe('compatibility route /notifications', () => {
  it('should return the newest notifications', async () => {
    const expected = notifications
      .slice(0, 5)
      .map((n) => ({ html: n.html, timestamp: n.timestamp.toISOString() }));

    return request(app.server).get('/v1/notifications').expect(200, expected);
  });
});
