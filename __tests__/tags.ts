import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
} from './helpers';
import { Keyword } from '../src/entity';
import { keywordsFixture } from './fixture/keywords';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';

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
});

beforeEach(async () => {
  loggedUser = null;

  await saveFixtures(con, Keyword, keywordsFixture);
});

afterAll(() => disposeGraphQLTesting(state));

describe('query popularTags', () => {
  const QUERY = `{
    popularTags {
      name
    }
  }`;

  it('should return most popular tags ordered by value', async () => {
    const res = await client.query(QUERY);
    expect(res.data).toMatchSnapshot();
  });
});

describe('query searchTags', () => {
  const QUERY = (query: string): string => `{
    searchTags(query: "${query}") {
      query
      hits {
        name
      }
    }
  }`;

  it('should search for tags and order by value', async () => {
    const res = await client.query(QUERY('dev'));
    expect(res.data).toMatchSnapshot();
  });

  it('should take into account keyword synonyms', async () => {
    const res = await client.query(QUERY('web-dev'));
    expect(res.data).toMatchSnapshot();
  });
});

describe('query onboardingTags', () => {
  const QUERY = `{
    onboardingTags {
      hits {
        name
      }
    }
  }`;

  beforeEach(async () => {
    await saveFixtures(
      con,
      Keyword,
      keywordsFixture.map((item) => ({
        ...item,
        flags: {
          onboarding: true,
        },
      })),
    );
  });

  it('should return onboarding tags', async () => {
    const res = await client.query(QUERY);

    expect(res.data).toMatchObject({
      onboardingTags: {
        hits: [
          { name: 'development' },
          { name: 'fullstack' },
          { name: 'golang' },
          { name: 'rust' },
          { name: 'webdev' },
        ],
      },
    });
  });
});
