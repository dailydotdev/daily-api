import { FastifyInstance } from 'fastify';
import { Alerts, ALERTS_DEFAULT } from '../src/entity';
import request from 'supertest';
import {
  authorizeRequest,
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  testMutationErrorCode,
} from './helpers';
import createOrGetConnection from '../src/db';
import { DataSource } from 'typeorm';

let app: FastifyInstance;
let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
  app = state.app;
});

afterAll(() => disposeGraphQLTesting(state));

beforeEach(async () => {
  loggedUser = null;
});

describe('query userAlerts', () => {
  const QUERY = `{
    userAlerts {
      filter
      rankLastSeen
      myFeed
      companionHelper
      lastChangelog
    }
  }`;

  it('should return alerts default values if anonymous', async () => {
    const res = await client.query(QUERY);
    res.data.userAlerts.changelog = false;
    expect(res.data.userAlerts).toEqual({
      ...ALERTS_DEFAULT,
      lastChangelog: res.data.userAlerts.lastChangelog,
    });
  });

  it('should return user alerts', async () => {
    loggedUser = '1';

    const repo = con.getRepository(Alerts);
    const alerts = repo.create({
      userId: '1',
      filter: true,
    });
    const expected = await repo.save(alerts);
    const res = await client.query(QUERY);

    delete expected.userId;

    expect(res.data.userAlerts).toEqual({
      ...expected,
      lastChangelog: expected.lastChangelog.toISOString(),
    });
  });
});

describe('mutation updateUserAlerts', () => {
  const MUTATION = `
    mutation UpdateUserAlerts($data: UpdateAlertsInput!) {
      updateUserAlerts(data: $data) {
        filter
        rankLastSeen
        myFeed
        companionHelper
      }
    }
  `;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { data: { filter: false } },
      },
      'UNAUTHENTICATED',
    ));

  it('should create user alerts when does not exist', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { data: { filter: false } },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should update alerts of user', async () => {
    loggedUser = '1';

    const rankLastSeenOld = new Date('2020-09-21T07:15:51.247Z');
    const repo = con.getRepository(Alerts);
    await repo.save(
      repo.create({
        userId: '1',
        filter: true,
        rankLastSeen: rankLastSeenOld,
        myFeed: 'created',
        companionHelper: true,
      }),
    );

    const rankLastSeen = new Date('2020-09-22T12:15:51.247Z');
    const res = await client.mutate(MUTATION, {
      variables: {
        data: {
          filter: false,
          rankLastSeen: rankLastSeen.toISOString(),
          myFeed: 'created',
          companionHelper: false,
        },
      },
    });

    expect(res.data).toMatchSnapshot();
  });
});

describe('dedicated api routes', () => {
  describe('GET /alerts', () => {
    it('should return user alerts', async () => {
      const repo = con.getRepository(Alerts);
      const alerts = repo.create({
        userId: '1',
        myFeed: 'created',
      });
      const data = await repo.save(alerts);
      const expected = new Object(data);
      delete expected['userId'];

      loggedUser = '1';
      const res = await authorizeRequest(
        request(app.server).get('/alerts'),
      ).expect(200);
      expect(res.body).toEqual({
        ...expected,
        lastChangelog: expected['lastChangelog'].toISOString(),
      });
    });
  });
});
