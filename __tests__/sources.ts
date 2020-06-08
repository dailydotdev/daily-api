import { ApolloServer } from 'apollo-server-fastify';
import {
  ApolloServerTestClient,
  createTestClient,
} from 'apollo-server-testing';
import { Connection, getConnection } from 'typeorm';
import { mocked } from 'ts-jest/utils';

import { Context } from '../src/Context';
import createApolloServer from '../src/apollo';
import {
  MockContext,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import { Source, SourceDisplay, SourceFeed } from '../src/entity';
import { addOrRemoveSuperfeedrSubscription } from '../src/common';
import appFunc from '../src';
import { FastifyInstance } from 'fastify';
import * as request from 'supertest';

jest.mock('../src/common', () => ({
  ...jest.requireActual('../src/common'),
  addOrRemoveSuperfeedrSubscription: jest.fn(),
}));

let con: Connection;
let server: ApolloServer;
let client: ApolloServerTestClient;
let loggedUser: string = null;
let premiumUser: boolean;

const sourceFromId = (id: string): Source => {
  const source = new Source();
  source.id = id;
  return source;
};

const createSourceDisplay = (
  sourceId: string,
  name: string,
  image: string,
  userId?: string,
  enabled = true,
): SourceDisplay => {
  const display = new SourceDisplay();
  display.sourceId = sourceId;
  display.name = name;
  display.image = image;
  display.enabled = enabled;
  display.userId = userId;
  return display;
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
  await con
    .getRepository(Source)
    .save([sourceFromId('a'), sourceFromId('b'), sourceFromId('c')]);
  await con
    .getRepository(SourceDisplay)
    .save([
      createSourceDisplay('a', 'A', 'http://a.com'),
      createSourceDisplay('b', 'B', 'http://b.com'),
      createSourceDisplay('a', 'Private A 1', 'http://privatea1.com', '1'),
      createSourceDisplay('b', 'Private B 1', 'http://privateb1.com', '1'),
      createSourceDisplay('b', 'Private B 2', 'http://privateb2.com', '2'),
      createSourceDisplay('c', 'Private C 2', 'http://privatec2.com', '2'),
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

  it('should return private display over public', async () => {
    loggedUser = '1';
    const res = await client.query({ query: QUERY() });
    expect(res.data).toMatchSnapshot();
  });

  it('should return private source even without public', async () => {
    loggedUser = '2';
    const res = await client.query({ query: QUERY() });
    expect(res.data).toMatchSnapshot();
  });

  it('should flag that more pages available', async () => {
    const res = await client.query({ query: QUERY(1) });
    expect(res.data).toMatchSnapshot();
  });
});

describe('query sourceByFeeds', () => {
  const QUERY = `
query SourceByFeeds($data: [String!]!) {
  sourceByFeeds(feeds: $data) {
    id
    name
    image
    public
  }
}`;

  it('should not authorize when not logged in', () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { data: ['https://a.com/feed'] } },
      'UNAUTHENTICATED',
    ));

  it('should return null when feed does not exist', async () => {
    loggedUser = '1';
    const res = await client.query({
      query: QUERY,
      variables: { data: ['https://a.com/feed'] },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.sourceByFeeds).toEqual(null);
  });

  it('should return the source', async () => {
    loggedUser = '1';
    await con.getRepository(SourceFeed).save({
      feed: 'https://a.com/feed',
      sourceId: 'a',
    });
    const res = await client.query({
      query: QUERY,
      variables: { data: ['https://a.com/feed'] },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.sourceByFeeds).toEqual({
      id: 'a',
      name: 'Private A 1',
      image: 'http://privatea1.com',
      public: false,
    });
  });
});

describe('mutation addPrivateSource', () => {
  const MUTATION = `
  mutation AddPrivateSource($data: AddPrivateSourceInput!) {
  addPrivateSource(data: $data) {
    id, name, image, public
  }
}`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          data: {
            name: 'Example',
            image: 'https://example.com',
            rss: ['https://example.com/feed'],
          },
        },
      },
      'UNAUTHENTICATED',
    ));

  it('should not authorize when not premium user', () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          data: {
            name: 'Example',
            image: 'https://example.com',
            rss: ['https://example.com/feed'],
          },
        },
      },
      'FORBIDDEN',
    );
  });

  it('should return existing source', async () => {
    loggedUser = '1';
    premiumUser = true;

    await con.getRepository(SourceFeed).save({
      feed: 'https://a.com/feed',
      sourceId: 'a',
    });
    const res = await client.mutate({
      mutation: MUTATION,
      variables: {
        data: {
          name: 'Example',
          image: 'https://example.com',
          rss: ['https://example.com/feed', 'https://a.com/feed'],
        },
      },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.addPrivateSource).toEqual({
      id: 'a',
      name: 'Private A 1',
      image: 'http://privatea1.com',
      public: false,
    });
  });

  it('should create new source', async () => {
    loggedUser = '1';
    premiumUser = true;
    mocked(addOrRemoveSuperfeedrSubscription).mockResolvedValue();
    const res = await client.mutate({
      mutation: MUTATION,
      variables: {
        data: {
          name: 'Example',
          image: 'https://example.com',
          rss: ['https://example.com/feed'],
        },
      },
    });
    expect(res.errors).toBeFalsy();
    expect(addOrRemoveSuperfeedrSubscription).toBeCalledWith(
      'https://example.com/feed',
      expect.anything(),
      'subscribe',
    );
    const { id } = res.data.addPrivateSource;
    expect(await con.getRepository(Source).findOne({ id })).toEqual({
      id: expect.anything(),
      twitter: null,
      website: null,
    });
    expect(
      await con.getRepository(SourceDisplay).findOne({ sourceId: id }),
    ).toEqual({
      id: expect.anything(),
      sourceId: expect.anything(),
      name: 'Example',
      image: 'https://example.com',
      enabled: true,
      userId: loggedUser,
    });
    expect(
      await con.getRepository(SourceFeed).findOne({ sourceId: id }),
    ).toEqual({
      sourceId: expect.anything(),
      feed: 'https://example.com/feed',
    });
    expect(res.data.addPrivateSource).toEqual({
      id: expect.anything(),
      name: 'Example',
      image: 'https://example.com',
      public: false,
    });
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
