import { ApolloServer } from 'apollo-server-fastify';
import {
  ApolloServerTestClient,
  createTestClient,
} from 'apollo-server-testing';
import { Connection, getConnection } from 'typeorm';
import { mocked } from 'ts-jest/utils';

import { Context } from '../src/Context';
import createApolloServer from '../src/apollo';
import { MockContext, testQueryErrorCode } from './helpers';
import { Source, SourceFeed } from '../src/entity';
import { addOrRemoveSuperfeedrSubscription } from '../src/common';
import appFunc from '../src';
import { FastifyInstance } from 'fastify';
import request from 'supertest';

jest.mock('../src/common', () => ({
  ...jest.requireActual('../src/common'),
  addOrRemoveSuperfeedrSubscription: jest.fn(),
}));

let con: Connection;
let server: ApolloServer;
let client: ApolloServerTestClient;
let loggedUser: string = null;
let premiumUser: boolean;

const createSource = (id: string, name: string, image: string): Source => {
  const source = new Source();
  source.id = id;
  source.name = name;
  source.image = image;
  source.active = true;
  source.private = false;
  return source;
};

beforeAll(async () => {
  con = getConnection();
  server = await createApolloServer({
    context: (): Context => new MockContext(con, loggedUser, premiumUser),
    playground: false,
  });
  client = createTestClient(server);
});

beforeEach(async () => {
  loggedUser = null;
  premiumUser = false;
  mocked(addOrRemoveSuperfeedrSubscription).mockReset();
  await con
    .getRepository(Source)
    .save([
      createSource('a', 'A', 'http://a.com'),
      createSource('b', 'B', 'http://b.com'),
    ]);
});

describe('query sources', () => {
  const QUERY = (first = 10): string => `{
  sources(first: ${first}) {
    pageInfo {
      endCursor
      hasNextPage
    }
    edges {
      node {
        id
        name
        image
        public
      }
    }
  }
}`;

  it('should return only public sources', async () => {
    const res = await client.query({ query: QUERY() });
    expect(res.data).toMatchSnapshot();
  });

  it('should flag that more pages available', async () => {
    const res = await client.query({ query: QUERY(1) });
    expect(res.data).toMatchSnapshot();
  });

  it('should return only active sources', async () => {
    await con
      .getRepository(Source)
      .save([{ id: 'd', active: false, name: 'D', image: 'http://d.com' }]);
    const res = await client.query({ query: QUERY() });
    expect(res.data).toMatchSnapshot();
  });
});

describe('query sourceByFeed', () => {
  const QUERY = `
query SourceByFeed($data: String!) {
  sourceByFeed(feed: $data) {
    id
    name
    image
    public
  }
}`;

  it('should not authorize when not logged in', () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { data: 'https://a.com/feed' } },
      'UNAUTHENTICATED',
    ));

  it('should return null when feed does not exist', async () => {
    loggedUser = '1';
    const res = await client.query({
      query: QUERY,
      variables: { data: 'https://a.com/feed' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.sourceByFeed).toEqual(null);
  });

  it('should return the source', async () => {
    loggedUser = '1';
    await con.getRepository(SourceFeed).save({
      feed: 'https://a.com/feed',
      sourceId: 'a',
    });
    const res = await client.query({
      query: QUERY,
      variables: { data: 'https://a.com/feed' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.sourceByFeed).toEqual({
      id: 'a',
      name: 'A',
      image: 'http://a.com',
      public: true,
    });
  });
});

describe('query source', () => {
  const QUERY = `
query Source($id: ID!) {
  source(id: $id) {
    id
    name
    image
    public
  }
}
  `;

  it('should not authorize when not logged in', () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { id: 'notexist' } },
      'NOT_FOUND',
    ));

  it('should return source by', async () => {
    const res = await client.query({ query: QUERY, variables: { id: 'a' } });
    expect(res.data).toMatchSnapshot();
  });
});

describe('compatibility route /publications', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await appFunc();
    return app.ready();
  });

  afterAll(() => app.close());

  it('should return only public sources', async () => {
    const res = await request(app.server).get('/v1/publications').expect(200);
    expect(res.body).toMatchSnapshot();
  });
});
