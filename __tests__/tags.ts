import { FastifyInstance } from 'fastify';
import { Connection, getConnection } from 'typeorm';
import request from 'supertest';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
} from './helpers';
import { Keyword } from '../src/entity';
import { keywordsFixture } from './fixture/keywords';

let app: FastifyInstance;
let con: Connection;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;

beforeAll(async () => {
  con = await getConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
  app = state.app;
});

beforeEach(async () => {
  loggedUser = null;

  await saveFixtures(con, Keyword, keywordsFixture);
});

afterAll(() => disposeGraphQLTesting(state));

describe('query popularTags', () => {
  const QUERY = `{
    popularTags {
      name
    }
  }`;

  it('should return most popular tags ordered by value', async () => {
    const res = await client.query(QUERY);
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

  it('should search for tags and order by value', async () => {
    const res = await client.query(QUERY('dev'));
    expect(res.data).toMatchSnapshot();
  });

  it('should take into account keyword synonyms', async () => {
    const res = await client.query(QUERY('web-dev'));
    expect(res.data).toMatchSnapshot();
  });
});

describe('compatibility routes', () => {
  describe('GET /tags/latest', () => {
    it('should return most popular tags ordered by value', async () => {
      const res = await request(app.server)
        .get('/v1/tags/popular')
        .send()
        .expect(200);
      expect(res.body).toMatchSnapshot();
    });
  });

  describe('GET /tags/search', () => {
    it('should search for tags and order by value', async () => {
      const res = await request(app.server)
        .get('/v1/tags/search?query=dev')
        .send()
        .expect(200);
      expect(res.body).toMatchSnapshot();
    });
  });
});
