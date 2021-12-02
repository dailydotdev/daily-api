import { Connection, getConnection } from 'typeorm';
import { FastifyInstance } from 'fastify';
import request from 'supertest';
import {
  authorizeRequest,
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import { Settings } from '../src/entity';

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
});

afterAll(() => disposeGraphQLTesting(state));

describe('query userSettings', () => {
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
    openNewTab
  }
}`;

  it('should not authorize when not logged-in', () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

  it('should return user settings', async () => {
    loggedUser = '1';

    const repo = con.getRepository(Settings);
    const settings = repo.create({
      userId: '1',
      theme: 'bright',
      insaneMode: true,
    });
    const expected = new Object(await repo.save(settings));
    delete expected['updatedAt'];

    const res = await client.query(QUERY);
    expect(res.data.userSettings).toEqual(expected);
  });

  it('should create default settings if not exist', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY);
    expect(res.data.userSettings).toMatchSnapshot();
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
    openNewTab
  }
}`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { data: { theme: 'bright', insaneMode: true } },
      },
      'UNAUTHENTICATED',
    ));

  it('should create user settings when does not exist', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
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

    const res = await client.mutate(MUTATION, {
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
      const expected = new Object(await repo.save(settings));
      expected['showOnlyNotReadPosts'] = expected['showOnlyUnreadPosts'];
      delete expected['updatedAt'];
      delete expected['showOnlyUnreadPosts'];

      loggedUser = '1';
      const res = await authorizeRequest(
        request(app.server).get('/v1/settings'),
      ).expect(200);
      expect(res.body).toEqual(expected);
    });
  });

  describe('POST /settings', () => {
    it('should update user settings', async () => {
      loggedUser = '1';
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
