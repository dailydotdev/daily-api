import { FastifyInstance } from 'fastify';
import { Connection, getConnection } from 'typeorm';
import { ApolloServer } from 'apollo-server-fastify';
import {
  ApolloServerTestClient,
  createTestClient,
} from 'apollo-server-testing';
import * as request from 'supertest';
import * as _ from 'lodash';

import createApolloServer from '../src/apollo';
import { Context } from '../src/Context';
import { MockContext, saveFixtures } from './helpers';
import appFunc from '../src';
import { Post, PostTag, Source, SourceDisplay } from '../src/entity';
import { sourcesFixture } from './fixture/source';
import { postsFixture, postTagsFixture } from './fixture/post';
import { sourceDisplaysFixture } from './fixture/sourceDisplay';
import { Ranking } from '../src/schema/feed';

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

  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, SourceDisplay, sourceDisplaysFixture);
  await saveFixtures(con, Post, postsFixture);
  await saveFixtures(con, PostTag, postTagsFixture);
});

afterAll(() => app.close());

describe('query anonymousFeed', () => {
  const QUERY = (
    ranking: Ranking = Ranking.POPULARITY,
    now = new Date(),
    first = 10,
  ): string => `
  query AnonymousFeed($filters: FiltersInput) {
    anonymousFeed(filters: $filters, ranking: ${ranking}, now: "${now.toISOString()}", first: ${first}) {
      pageInfo {
        endCursor
        hasNextPage
      }
      edges {
        node {
          id
          url
          title
          image
          ratio
          placeholder
          readTime
          tags
          source {
            id
            name
            image
            public
          }
        }
      }
    }
  }
`;

  it('should return anonymous feed with no filters ordered by popularity', async () => {
    const res = await client.query({ query: QUERY() });
    expect(res.data).toMatchSnapshot();
  });

  it('should return anonymous feed with no filters ordered by time', async () => {
    const res = await client.query({ query: QUERY(Ranking.TIME) });
    expect(res.data).toMatchSnapshot();
  });

  it('should return anonymous feed filtered by sources', async () => {
    const res = await client.query({
      query: QUERY(),
      variables: { filters: { includeSources: ['a', 'b'] } },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should return anonymous feed filtered by tags', async () => {
    const res = await client.query({
      query: QUERY(),
      variables: { filters: { includeTags: ['html', 'webdev'] } },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should return anonymous feed while excluding sources', async () => {
    const res = await client.query({
      query: QUERY(),
      variables: { filters: { excludeSources: ['a'] } },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should return anonymous feed filtered by tags and sources', async () => {
    const res = await client.query({
      query: QUERY(),
      variables: {
        filters: {
          includeTags: ['javascript'],
          includeSources: ['a', 'b'],
        },
      },
    });
    expect(res.data).toMatchSnapshot();
  });
});

describe('compatibility routes', () => {
  describe('GET /posts/latest', () => {
    it('should return anonymous feed with no filters ordered by popularity', async () => {
      const res = await request(app.server)
        .get('/v1/posts/latest')
        .query({ latest: new Date(), pageSize: 2, page: 0 })
        .send()
        .expect(200);
      expect(res.body.map((x) => _.omit(x, ['createdAt']))).toMatchSnapshot();
    });

    it('should return anonymous feed filtered by sources', async () => {
      const res = await request(app.server)
        .get('/v1/posts/latest')
        .query({ latest: new Date(), sources: ['a', 'b'] })
        .send()
        .expect(200);
      expect(res.body.map((x) => _.omit(x, ['createdAt']))).toMatchSnapshot();
    });

    it('should return anonymous feed filtered by tags', async () => {
      const res = await request(app.server)
        .get('/v1/posts/latest')
        .query({ latest: new Date(), tags: ['html', 'webdev'] })
        .send()
        .expect(200);
      expect(res.body.map((x) => _.omit(x, ['createdAt']))).toMatchSnapshot();
    });

    it('should return anonymous feed filtered by tags and sources', async () => {
      const res = await request(app.server)
        .get('/v1/posts/latest')
        .query({
          latest: new Date(),
          tags: ['javascript'],
          sources: ['a', 'b'],
        })
        .send()
        .expect(200);
      expect(res.body.map((x) => _.omit(x, ['createdAt']))).toMatchSnapshot();
    });
  });
});
