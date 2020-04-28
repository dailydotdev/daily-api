import { ApolloServer } from 'apollo-server-fastify';
import {
  ApolloServerTestClient,
  createTestClient,
} from 'apollo-server-testing';
import { Connection, getConnection } from 'typeorm';
import { FastifyInstance } from 'fastify';
import * as request from 'supertest';
import { classToPlain } from 'class-transformer';

import { Context } from '../src/Context';
import createApolloServer from '../src/apollo';
import {
  authorizeRequest,
  MockContext,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import appFunc from '../src';
import { Settings } from '../src/entity';

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
});

afterAll(() => app.close());

describe('query pendingSourceRequests', () => {
  const QUERY = `{
  userSettings {
    userId
    theme
    enableCardAnimations
    showTopSites
    insaneMode
    appInsaneMode
    spaciness
    showOnlyUnreadPosts
  }
}`;

  it('should not authorize when not logged-in', () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHORIZED_ERROR'));

  it('should return user settings', async () => {
    loggedUser = '1';

    const repo = con.getRepository(Settings);
    const settings = repo.create({
      userId: '1',
      theme: 'bright',
      insaneMode: true,
    });
    const expected = classToPlain(await repo.save(settings));
    delete expected['updatedAt'];

    const res = await client.query({ query: QUERY });
    expect(res.data.userSettings).toEqual(expected);
  });
});

describe('mutation updateUserSettings', () => {
  const MUTATION = `
  mutation UpdateUserSettings($data: UpdateSettingsInput!) {
  updateUserSettings(data: $data) {
    userId
    theme
    enableCardAnimations
    showTopSites
    insaneMode
    appInsaneMode
    spaciness
    showOnlyUnreadPosts
  }
}`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { data: { theme: 'bright', insaneMode: true } },
      },
      'UNAUTHORIZED_ERROR',
    ));

  it('should create user settings when does not exist', async () => {
    loggedUser = '1';
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { data: { theme: 'bright', insaneMode: true } },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should update user settings', async () => {
    loggedUser = '1';

    const repo = con.getRepository(Settings);
    await repo.save(
      repo.create({
        userId: '1',
        theme: 'bright',
        insaneMode: true,
      }),
    );

    const res = await client.mutate({
      mutation: MUTATION,
      variables: { data: { appInsaneMode: false } },
    });
    expect(res.data).toMatchSnapshot();
  });
});

describe('compatibility routes', () => {
  describe('GET /settings', () => {
    it('should return user settings', async () => {
      const repo = con.getRepository(Settings);
      const settings = repo.create({
        userId: '1',
        theme: 'bright',
        insaneMode: true,
      });
      const expected = classToPlain(await repo.save(settings));
      delete expected['updatedAt'];

      const res = await authorizeRequest(
        request(app.server).get('/v1/settings'),
      ).expect(200);
      expect(res.body).toEqual(expected);
    });
  });

  describe('POST /settings', () => {
    it('should update user settings', async () => {
      await authorizeRequest(
        request(app.server).post('/v1/settings').send({ theme: 'bright' }),
      ).expect(204);
      expect(
        await con.getRepository(Settings).findOne('1', {
          select: ['userId', 'theme', 'insaneMode'],
        }),
      ).toMatchSnapshot();
    });
  });
});
