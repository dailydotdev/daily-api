import { ApolloServer } from 'apollo-server-fastify';
import {
  ApolloServerTestClient,
  createTestClient,
} from 'apollo-server-testing';
import { Connection, getConnection } from 'typeorm';
import * as faker from 'faker';

import { Context } from '../src/Context';
import createApolloServer from '../src/apollo';
import { MockContext } from './helpers';
import { Notification } from '../src/entity';
import appFunc from '../src';
import { FastifyInstance } from 'fastify';
import * as request from 'supertest';

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
