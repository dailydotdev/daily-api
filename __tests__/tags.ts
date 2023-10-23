import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testQueryError,
} from './helpers';
import { ArticlePost, Keyword, PostKeyword, Source } from '../src/entity';
import {
  keywordsFixture,
  postRecommendedKeywordsFixture,
} from './fixture/keywords';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { postsFixture, postKeywordsFixture } from './fixture/post';
import { sourcesFixture } from './fixture/source';
import { TagRecommendation } from '../src/entity/TagRecommendation';
import { SubmissionFailErrorMessage } from '../src/errors';

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

    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchObject({
      onboardingTags: {
        hits: [
          { name: 'development' },
          { name: 'fullstack' },
          { name: 'golang' },
          { name: 'pending' },
          { name: 'politics' },
          { name: 'rust' },
          { name: 'web-development' },
          { name: 'webdev' },
        ],
      },
    });
  });
});

describe('query recommendedTags', () => {
  const QUERY = `
    query recommendedTags($tags: [String]!, $excludedTags: [String]!) {
      recommendedTags(tags: $tags, excludedTags: $excludedTags) {
        hits {
          name
        }
      }
    }`;

  beforeEach(async () => {
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, ArticlePost, postsFixture);
    await saveFixtures(
      con,
      Keyword,
      postRecommendedKeywordsFixture.map((item) => ({
        ...item,
        flags: {
          onboarding: true,
        },
      })),
    );
    await saveFixtures(
      con,
      PostKeyword,
      postKeywordsFixture.map((item) => ({
        ...item,
        status: 'allow',
      })),
    );

    const materializedViewName =
      con.getRepository(TagRecommendation).metadata.tableName;
    await con.query(`REFRESH MATERIALIZED VIEW ${materializedViewName}`);
  });

  it('should return recommended tags', async () => {
    const res = await client.query(QUERY, {
      variables: {
        tags: ['javascript'],
        excludedTags: [],
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchObject({
      recommendedTags: {
        hits: [
          { name: 'backend' },
          { name: 'data' },
          { name: 'html' },
          { name: 'webdev' },
        ],
      },
    });
  });

  it('should not include origin tags in recommended tags', async () => {
    const originTags = ['javascript', 'webdev'];

    const res = await client.query(QUERY, {
      variables: {
        tags: originTags,
        excludedTags: [],
      },
    });

    expect(res.errors).toBeFalsy();
    originTags.forEach((tag) => {
      expect(
        res.data.recommendedTags.hits.find(
          (hit: { name: string }) => hit.name === tag,
        ),
      ).toBeFalsy();
    });
  });

  it('should not return excluded tags in recommended tags', async () => {
    const res = await client.query(QUERY, {
      variables: {
        tags: ['javascript'],
        excludedTags: ['html', 'data'],
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchObject({
      recommendedTags: {
        hits: [{ name: 'backend' }, { name: 'webdev' }],
      },
    });
  });

  it('should return empty array if no tags are provided', async () => {
    const res = await client.query(QUERY, {
      variables: {
        tags: [],
        excludedTags: [],
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchObject({
      recommendedTags: {
        hits: [],
      },
    });
  });

  it('should throw validation error if more then 1000 tags is included', async () => {
    await testQueryError(
      client,
      {
        query: QUERY,
        variables: {
          tags: new Array(800).fill('tag').map((item, index) => item + index),
          excludedTags: new Array(500)
            .fill('excTag')
            .map((item, index) => item + index),
        },
      },
      (errors) => {
        expect(errors[0].extensions?.code).toEqual('GRAPHQL_VALIDATION_FAILED');
        expect(errors[0].message).toEqual(
          SubmissionFailErrorMessage.ONBOARDING_TAG_LIMIT_REACHED,
        );
      },
    );
  });
});
