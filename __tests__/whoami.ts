import { FastifyInstance } from 'fastify';
import { User } from '../src/entity';
import request from 'supertest';
import {
  authorizeRequest,
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
} from './helpers';
import { userCreatedDate, usersFixture } from './fixture/user';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { DEFAULT_TIMEZONE } from '../src/types';

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
  await con.getRepository(User).save({ ...usersFixture[0] });
});

describe('query whoami', () => {
  const QUERY = `{
    whoami {
      id
      name
      image
      createdAt
      username
      bio
      twitter
      github
      hashnode
      infoConfirmed
      timezone
    }
  }`;

  it('should return null if anonymous', async () => {
    const res = await client.query(QUERY);

    expect(res.data.whoami).toEqual(null);
  });

  it('should return whoami', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { email, ...user } = usersFixture[0];
    expect(res.data.whoami).toEqual({
      ...user,
      timezone: DEFAULT_TIMEZONE,
      createdAt: userCreatedDate,
    });
  });
});

describe('dedicated api routes', () => {
  describe('GET /whoami', () => {
    it('should return whoami data', async () => {
      loggedUser = '1';
      const res = await authorizeRequest(
        request(app.server).get('/whoami'),
      ).expect(200);

      expect(res.body).toEqual({
        ...usersFixture[0],
        company: null,
        portfolio: null,
        title: null,
        timezone: DEFAULT_TIMEZONE,
        createdAt: userCreatedDate,
        reputation: 10,
        acceptedMarketing: false,
        notificationEmail: true,
      });
    });
  });
});
