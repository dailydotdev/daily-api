import { ApolloServer } from 'apollo-server-fastify';
import {
  ApolloServerTestClient,
  createTestClient,
} from 'apollo-server-testing';
import { Connection, getConnection } from 'typeorm';
import * as nock from 'nock';
import { FastifyInstance } from 'fastify';
import * as request from 'supertest';
import * as _ from 'lodash';

import { Context } from '../src/Context';
import createApolloServer from '../src/apollo';
import { authorizeRequest, MockContext } from './helpers';
import appFunc from '../src';
import { RequestSourceInput } from '../src/resolver';
import { Roles } from '../src/authChecker';
import { SourceRequest } from '../src/entity';
import { sourceRequestFixture } from './fixture/sourceRequest';

let con: Connection;
let server: ApolloServer;
let client: ApolloServerTestClient;
let loggedUser: string = null;

const mockInfo = (): nock.Scope =>
  nock(process.env.GATEWAY_URL)
    .get('/v1/users/me/info')
    .matchHeader('authorization', `Service ${process.env.GATEWAY_SECRET}`)
    .matchHeader('user-id', '1')
    .matchHeader('logged-in', 'true')
    .reply(200, { email: 'ido@daily.dev', name: 'Ido' });

const mockRoles = (roles: Roles[] = []): nock.Scope =>
  nock(process.env.GATEWAY_URL)
    .get('/v1/users/me/roles')
    .matchHeader('authorization', `Service ${process.env.GATEWAY_SECRET}`)
    .matchHeader('user-id', '1')
    .matchHeader('logged-in', 'true')
    .reply(200, roles);

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
});

describe('mutation requestSource', () => {
  const MUTATION = `
  mutation RequestSource($data: RequestSourceInput!) {
  requestSource(data: $data) {
    sourceUrl
    userId
    userName
    userEmail
  }
}`;

  it('should not authorize when not logged in', async () => {
    const data: RequestSourceInput = { sourceUrl: 'http://source.com' };
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { data },
    });
    expect(res.errors).toMatchSnapshot();
  });

  it('should return bad request when url is not valid', async () => {
    loggedUser = '1';
    const data: RequestSourceInput = { sourceUrl: 'invalid' };
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { data },
    });
    expect(res.errors).toMatchSnapshot();
  });

  it('should add new source request', async () => {
    mockInfo();
    loggedUser = '1';
    const data: RequestSourceInput = { sourceUrl: 'http://source.com' };
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { data },
    });
    expect(res.data).toMatchSnapshot();
  });
});

describe('query pendingSourceRequests', () => {
  const QUERY = (first = 10): string => `{
  pendingSourceRequests(first: ${first}) {
    pageInfo {
      endCursor
      hasNextPage
    }
    edges {
      node {
        sourceUrl
      }
    }
  }
}`;

  it('should not authorize when not moderator', async () => {
    mockRoles();
    loggedUser = '1';
    const res = await client.query({ query: QUERY() });
    expect(res.errors).toMatchSnapshot();
  });

  it('should return pending source requests', async () => {
    mockRoles([Roles.Moderator]);
    loggedUser = '1';

    for (const req of sourceRequestFixture) {
      await con.getRepository(SourceRequest).save(req);
    }

    const res = await client.query({ query: QUERY() });
    expect(res.data).toMatchSnapshot();
  });
});

describe('compatibility routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await appFunc();
    return app.ready();
  });

  afterAll(() => app.close());

  describe('POST /publications/request', () => {
    it('should not authorize when not logged in', () => {
      return request(app.server)
        .post('/v1/publications/request')
        .send({ url: 'http://source.com' })
        .expect(401);
    });

    it('should return bad request when url is not valid', () => {
      return authorizeRequest(
        request(app.server).post('/v1/publications/request'),
      )
        .send({ url: 'invalid' })
        .expect(400);
    });

    it('should request new source', () => {
      mockInfo();
      return authorizeRequest(
        request(app.server).post('/v1/publications/request'),
      )
        .send({ url: 'http://source.com' })
        .expect(204);
    });

    it('should request new source (/requests)', () => {
      mockInfo();
      return authorizeRequest(
        request(app.server).post('/v1/publications/requests'),
      )
        .send({ url: 'http://source.com' })
        .expect(204);
    });
  });

  describe('GET /publications/requests/open', () => {
    it('should return pending source requests', async () => {
      mockRoles([Roles.Moderator]);

      for (const req of sourceRequestFixture) {
        await con.getRepository(SourceRequest).save(req);
      }

      const res = await authorizeRequest(
        request(app.server).get('/v1/publications/requests/open'),
      ).expect(200);
      const actual = res.body.map((x) => _.omit(x, ['id', 'createdAt']));
      expect(actual).toMatchSnapshot();
    });
  });
});
