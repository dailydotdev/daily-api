import { ApolloServer } from 'apollo-server-fastify';
import {
  ApolloServerTestClient,
  createTestClient,
} from 'apollo-server-testing';
import { Connection, getConnection } from 'typeorm';
import faker from 'faker';
import _ from 'lodash';

import { Context } from '../src/Context';
import createApolloServer from '../src/apollo';
import { MockContext } from './helpers';
import { Integration } from '../src/entity';

let con: Connection;
let server: ApolloServer;
let client: ApolloServerTestClient;
let integrations: Integration[];

beforeAll(async () => {
  con = getConnection();
  server = await createApolloServer({
    context: (): Context => new MockContext(con),
    playground: false,
  });
  client = createTestClient(server);
});

beforeEach(async () => {
  const now = new Date();
  const randomDate = (): Date => faker.date.past(null, now);
  integrations = Array.from(Array(5))
    .map(() =>
      con.getRepository(Integration).create({
        timestamp: randomDate(),
        logo: faker.image.imageUrl(),
        title: faker.random.words(1),
        subtitle: faker.random.words(1),
        url: faker.internet.url(),
      }),
    )
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  await con.getRepository(Integration).save(integrations);
});

describe('query popularIntegrations', () => {
  const QUERY = `{
  popularIntegrations {
    logo, title, subtitle, url
  }
}`;

  it('should return the popular integrations', async () => {
    const expected = integrations.map((i) => _.omit(i, 'timestamp'));

    const res = await client.query({ query: QUERY });
    expect(res.data.popularIntegrations).toEqual(expected);
  });
});
