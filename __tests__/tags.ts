import { FastifyInstance } from 'fastify';
import { Connection, getConnection } from 'typeorm';
import { ApolloServer } from 'apollo-server-fastify';
import {
  ApolloServerTestClient,
  createTestClient,
} from 'apollo-server-testing';
import request from 'supertest';

import createApolloServer from '../src/apollo';
import { Context } from '../src/Context';
import { MockContext, saveFixtures } from './helpers';
import appFunc from '../src';
import { TagCount } from '../src/entity';
import { tagCountsFixture } from './fixture/tagCount';

let app: FastifyInstance;
let con: Connection;
let server: ApolloServer;
let client: ApolloServerTestClient;
let loggedUser: string = null;

beforeAll(async () => {
  con = await getConnection();
  server = await createApolloServer({
    context: (): Context => new MockContext(con, loggedUser),
    playground: false,
  });
  client = createTestClient(server);
  app = await appFunc();
  return app.ready();
});

beforeEach(async () => {
  loggedUser = null;

  await saveFixtures(con, TagCount, tagCountsFixture);
});

afterAll(() => app.close());

describe('query popularTags', () => {
  const QUERY = `{
    popularTags {
      name
    }
  }`;

  it('should return most popular tags ordered by count', async () => {
    const res = await client.query({ query: QUERY });
    expect(res.data).toMatchSnapshot();
  });
});

describe('query searchTags', () => {
  const QUERY = (query: string): string => `{
    searchTags(query: "${query}") {
      query
      hits {
        name
      }
    }
  }`;

  it('should search for tags and order by count', async () => {
    const res = await client.query({ query: QUERY('dev') });
    expect(res.data).toMatchSnapshot();
  });
});

describe('compatibility routes', () => {
  describe('GET /tags/latest', () => {
    it('should return most popular tags ordered by count', async () => {
      const res = await request(app.server)
        .get('/v1/tags/popular')
        .send()
        .expect(200);
      expect(res.body).toMatchSnapshot();
    });
  });

  describe('GET /tags/search', () => {
    it('should search for tags and order by count', async () => {
      const res = await request(app.server)
        .get('/v1/tags/search?query=dev')
        .send()
        .expect(200);
      expect(res.body).toMatchSnapshot();
    });
  });
});
