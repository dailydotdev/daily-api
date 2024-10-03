import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testQueryError,
} from './helpers';
import { ArticlePost, Keyword, Post, PostKeyword, Source } from '../src/entity';
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

describe('query tags', () => {
  const QUERY = `{
    tags {
      value
    }
  }`;

  it('should return all tags', async () => {
    const res = await client.query(QUERY);
    expect(res.data).toMatchObject({
      tags: [
        { value: 'development' },
        { value: 'fullstack' },
        { value: 'golang' },
        { value: 'rust' },
        { value: 'webdev' },
      ],
    });
  });
});

describe('query trendingTags', () => {
  const QUERY = `{
    trendingTags {
      name
    }
  }`;

  beforeEach(async () => {
    await saveFixtures(con, Source, sourcesFixture);
    let tags = 'tag1';
    await con.getRepository(Post).save(
      new Array(20).fill('tag').map((item, index) => {
        tags += `,tag${index + 1}`;
        return {
          id: `post_${index}`,
          shortId: `post_${index}`,
          title: `Post ${index}`,
          tagsStr: tags,
          upvotes: 10 + index,
          createdAt: new Date(),
          sourceId: 'a',
        };
      }),
    );
    await con.query(`REFRESH MATERIALIZED VIEW trending_post`);
    await con.query(`REFRESH MATERIALIZED VIEW trending_tag`);
  });

  it('should return most trending tags ordered by value', async () => {
    const res = await client.query(QUERY);
    expect(res.data).toMatchObject({
      trendingTags: [
        { name: 'tag19' },
        { name: 'tag18' },
        { name: 'tag17' },
        { name: 'tag16' },
        { name: 'tag15' },
        { name: 'tag14' },
        { name: 'tag13' },
        { name: 'tag12' },
        { name: 'tag11' },
        { name: 'tag10' },
      ],
    });
  });

  it('should return limit of 10 by default', async () => {
    const res = await client.query(QUERY);
    expect(res.data.trendingTags.length).toBe(10);
  });
});

describe('query popularTags', () => {
  const QUERY = `{
    popularTags {
      name
    }
  }`;

  beforeEach(async () => {
    await saveFixtures(con, Source, sourcesFixture);
    let tags = 'tag1';
    await con.getRepository(Post).save(
      new Array(20).fill('tag').map((item, index) => {
        tags += `,tag${index + 1}`;
        return {
          id: `post_${index}`,
          shortId: `post_${index}`,
          title: `Post ${index}`,
          tagsStr: tags,
          upvotes: 10 + index,
          createdAt: new Date(),
          sourceId: 'a',
        };
      }),
    );
    await con.query(`REFRESH MATERIALIZED VIEW popular_post`);
    await con.query(`REFRESH MATERIALIZED VIEW popular_tag`);
  });

  it('should return most popular tags ordered by value', async () => {
    const res = await client.query(QUERY);
    expect(res.data).toMatchObject({
      popularTags: [
        { name: 'tag10' },
        { name: 'tag9' },
        { name: 'tag8' },
        { name: 'tag7' },
        { name: 'tag6' },
        { name: 'tag5' },
        { name: 'tag4' },
        { name: 'tag3' },
        { name: 'tag2' },
        { name: 'tag1' },
      ],
    });
  });

  it('should return limit of 10 by default', async () => {
    const res = await client.query(QUERY);
    expect(res.data.popularTags.length).toBe(10);
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

  it('should return no results if query length is less then 2', async () => {
    const res = await client.query(QUERY('d'));
    expect(res.data).toMatchObject({
      searchTags: {
        query: 'd',
        hits: [],
      },
    });
  });

  it('should return no more then 100 results', async () => {
    await con.getRepository(Keyword).save(
      new Array(110).fill('tag').map((item, index) => ({
        value: item + index,
        occurances: 0,
        status: 'allow',
      })),
    );

    const res = await client.query(QUERY('tag'));

    expect(res.errors).toBeFalsy();
    expect(res.data.searchTags.hits.length).toBe(100);
  });
});

describe('query onboardingTags', () => {
  const QUERY = `query onboardingTags($shuffle: Boolean) {
    onboardingTags(shuffle: $shuffle) {
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

  it('should return shuffled tags', async () => {
    const res = await client.query(QUERY, {
      variables: { shuffle: true },
    });

    const expectedHits = [
      { name: 'development' },
      { name: 'fullstack' },
      { name: 'golang' },
      { name: 'pending' },
      { name: 'politics' },
      { name: 'rust' },
      { name: 'web-development' },
      { name: 'webdev' },
    ];

    expect(res.errors).toBeFalsy();
    expect(res.data).not.toMatchObject({
      onboardingTags: {
        hits: expectedHits,
      },
    });

    res.data.onboardingTags.hits.forEach((tag) => {
      expectedHits.map((hit) => hit.name).includes(tag.name);
    });
  });
});

describe('query recommendedTags', () => {
  const QUERY = `
    query recommendedTags($tags: [String]!, $excludedTags: [String]!, $shuffle: Boolean) {
      recommendedTags(tags: $tags, excludedTags: $excludedTags, shuffle: $shuffle) {
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

  it('should return shuffled recommended tags', async () => {
    const res = await client.query(QUERY, {
      variables: {
        tags: ['javascript'],
        excludedTags: [],
        shuffle: true,
      },
    });

    const expectedHits = [
      { name: 'backend' },
      { name: 'data' },
      { name: 'html' },
      { name: 'webdev' },
    ];

    expect(res.errors).toBeFalsy();
    expect(res.data).not.toMatchObject({
      recommendedTags: {
        hits: expectedHits,
      },
    });
    res.data.recommendedTags.hits.forEach((tag) => {
      expectedHits.map((hit) => hit.name).includes(tag.name);
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
