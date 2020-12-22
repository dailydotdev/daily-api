import { ApolloServer } from 'apollo-server-fastify';
import {
  ApolloServerTestClient,
  createTestClient,
} from 'apollo-server-testing';
import { Connection, getConnection } from 'typeorm';
import faker from 'faker';

import { Context } from '../src/Context';
import createApolloServer from '../src/apollo';
import { MockContext } from './helpers';
import { Banner, Notification } from '../src/entity';
import appFunc from '../src';
import { FastifyInstance } from 'fastify';
import request from 'supertest';

let con: Connection;
let server: ApolloServer;
let client: ApolloServerTestClient;
let notifications: Notification[];

beforeAll(async () => {
  con = await getConnection();
  server = await createApolloServer({
    context: (): Context => new MockContext(con),
    playground: false,
  });
  client = createTestClient(server);
});

beforeEach(async () => {
  const now = new Date();
  const randomDate = (): Date => faker.date.past(null, now);
  notifications = Array.from(Array(8))
    .map(() => new Notification(randomDate(), faker.random.words(5)))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  await con.getRepository(Notification).save(notifications);
});

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

    const res = await client.query({ query: QUERY });
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
    const res = await client.query({
      query: QUERY(new Date(now.getTime() - 100000)),
    });
    expect(res.data).toMatchSnapshot();
  });

  // it('should return empty response when no relevant banner', async () => {
  //   const res = await client.query({
  //     query: QUERY(new Date(now.getTime() + 1)),
  //   });
  //   expect(res.data).toMatchSnapshot();
  // });
});

describe('compatibility route /notifications', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await appFunc();
    return app.ready();
  });

  afterAll(() => app.close());

  it('should return the newest notifications', async () => {
    const expected = notifications
      .slice(0, 5)
      .map((n) => ({ html: n.html, timestamp: n.timestamp.toISOString() }));

    return request(app.server).get('/v1/notifications').expect(200, expected);
  });
});
