import { FastifyInstance } from 'fastify';
import { Keyword, User, UserTopReader } from '../src/entity';
import request from 'supertest';
import {
  authorizeRequest,
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
} from './helpers';
import { userCreatedDate, usersFixture } from './fixture/user';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { DEFAULT_TIMEZONE, type GQLUserTopReader } from '../src/common';
import { addHours, subMonths } from 'date-fns';

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

  describe('topReaderBadge', () => {
    const QUERY = `query Reader {
      whoami {
        topReader {
          id
          issuedAt
          image
          keyword {
            value
            flags {
              title
            }
          }
        }
      }
    }`;

    beforeEach(async () => {
      await saveFixtures(
        con,
        Keyword,
        [1, 2, 3, 4, 5, 6].map((key) => ({
          value: `kw_${key}`,
          flags: {
            title: `kw_${key} title`,
          },
        })),
      );
      await saveFixtures(con, User, [usersFixture[1]]);
      await saveFixtures(con, UserTopReader, [
        {
          userId: '1',
          issuedAt: new Date(),
          keywordValue: 'kw_1',
          image: 'https://daily.dev/image.jpg',
        },
        {
          userId: '1',
          issuedAt: subMonths(new Date(), 1),
          keywordValue: 'kw_2',
          image: 'https://daily.dev/image.jpg',
        },
        {
          userId: '1',
          issuedAt: subMonths(new Date(), 2),
          keywordValue: 'kw_3',
          image: 'https://daily.dev/image.jpg',
        },
        {
          userId: '1',
          issuedAt: subMonths(new Date(), 3),
          keywordValue: 'kw_4',
          image: 'https://daily.dev/image.jpg',
        },
        {
          userId: '1',
          issuedAt: subMonths(new Date(), 4),
          keywordValue: 'kw_5',
          image: 'https://daily.dev/image.jpg',
        },
        {
          userId: '1',
          issuedAt: addHours(new Date(), 1),
          keywordValue: 'kw_6',
          image: 'https://daily.dev/image.jpg',
        },
        {
          userId: '2',
          issuedAt: new Date(),
          keywordValue: 'kw_1',
          image: 'https://daily.dev/image.jpg',
        },
        {
          userId: '2',
          issuedAt: subMonths(new Date(), 1),
          keywordValue: 'kw_3',
          image: 'https://daily.dev/image.jpg',
        },
      ]);
    });

    it('should return the 5 most recent top reader badges', async () => {
      loggedUser = '1';
      const res = await client.query(QUERY);
      const topReader: GQLUserTopReader[] = res.data.whoami.topReader;

      expect(res.errors).toBeFalsy();
      expect(topReader.length).toEqual(5);
      expect(topReader[0].keyword.value).toEqual('kw_6');
      expect(topReader[topReader.length - 1].keyword.value).toEqual('kw_4');
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
        roadmap: null,
        threads: null,
        codepen: null,
        reddit: null,
        stackoverflow: null,
        youtube: null,
        linkedin: null,
        mastodon: null,
      });
    });
  });
});
