import { FastifyInstance } from 'fastify';
import { User } from '../src/entity';
import { Connection, getConnection } from 'typeorm';
import request from 'supertest';
import {
  authorizeRequest,
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
} from './helpers';
import { GQLUser } from '../src/schema/users';

let app: FastifyInstance;
let con: Connection;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;

const createdDate = '2022-06-28T14:48:47.891Z';
const defaultUser: GQLUser = {
  id: '1',
  bio: null,
  github: null,
  hashnode: null,
  name: 'Ido',
  image: 'https://daily.dev/image.jpg',
  createdAt: new Date(createdDate),
  twitter: null,
  username: 'idoshamun',
  infoConfirmed: true,
};

beforeAll(async () => {
  con = getConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
  app = state.app;
});

afterAll(() => disposeGraphQLTesting(state));

beforeEach(async () => {
  loggedUser = null;
  await con.getRepository(User).save({ ...defaultUser });
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
    }
  }`;

  it('should return null if anonymous', async () => {
    const res = await client.query(QUERY);

    expect(res.data.whoami).toEqual(null);
  });

  it('should return whoami', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY);
    expect(res.data.whoami).toEqual({
      ...defaultUser,
      createdAt: createdDate,
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
        ...defaultUser,
        createdAt: createdDate,
      });
    });
  });
});
