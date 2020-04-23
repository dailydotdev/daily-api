import { ApolloServer } from 'apollo-server-fastify';
import {
  ApolloServerTestClient,
  createTestClient,
} from 'apollo-server-testing';
import { Connection, getConnection } from 'typeorm';

import { Context } from '../src/Context';
import createApolloServer from '../src/apollo';
import { MockContext } from './helpers';
import { Source, SourceDisplay } from '../src/entity';
import appFunc from '../src';
import { FastifyInstance } from 'fastify';
import * as request from 'supertest';

let con: Connection;
let server: ApolloServer;
let client: ApolloServerTestClient;
let loggedUser: string = null;

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
  con = await getConnection();
  server = await createApolloServer({
    context: (): Context => new MockContext(con, loggedUser),
    playground: false,
  });
  client = createTestClient(server);
});

beforeEach(async () => {
  loggedUser = null;
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
