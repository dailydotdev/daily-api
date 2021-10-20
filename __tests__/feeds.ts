import { FeedAdvancedSettings } from './../src/entity/FeedAdvancedSettings';
import { AdvancedSettings } from './../src/entity/AdvancedSettings';
import { Category } from '../src/entity/Category';
import { FastifyInstance } from 'fastify';
import { Connection, getConnection, In } from 'typeorm';
import { ApolloServer } from 'apollo-server-fastify';
import {
  ApolloServerTestClient,
  createTestClient,
} from 'apollo-server-testing';
import request from 'supertest';
import _ from 'lodash';

import createApolloServer from '../src/apollo';
import { Context } from '../src/Context';
import {
  authorizeRequest,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import appFunc from '../src';
import {
  Feed,
  FeedSource,
  FeedTag,
  Post,
  PostTag,
  Source,
  View,
  BookmarkList,
  User,
  PostKeyword,
  Keyword,
} from '../src/entity';
import { sourcesFixture } from './fixture/source';
import {
  postKeywordsFixture,
  postsFixture,
  postTagsFixture,
} from './fixture/post';
import { Ranking } from '../src/common';
import nock from 'nock';
import { deleteKeysByPattern, redisClient } from '../src/redis';
import { getPersonalizedFeedKey } from '../src/personalizedFeed';

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

  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
  await saveFixtures(con, PostTag, postTagsFixture);
  await saveFixtures(con, PostKeyword, postKeywordsFixture);
  await deleteKeysByPattern('feeds:*');
});

afterAll(() => app.close());

const advancedSettings: Partial<AdvancedSettings>[] = [
  {
    id: 'tm',
    title: 'Tech magazines',
    description: 'Description for Tech magazines',
  },
  {
    id: 'n-ec',
    title: 'Non-editorial content',
    description: 'Description for Non-editorial content',
  },
  {
    id: 'rn',
    title: 'Release notes',
    description: 'Description for Release notes',
  },
  {
    id: 'ce',
    title: 'Code examples',
    description: 'Description for Code examples',
  },
  {
    id: 'cb',
    title: 'Company blogs',
    description: 'Description for Company blogs',
  },
];

const categories: Partial<Category>[] = [
  {
    id: 'FE',
    emoji: '🌈',
    title: 'Frontend',
    tags: ['html', 'javascript'],
  },
  {
    id: 'BE',
    emoji: '⚙️',
    title: 'Backend',
    tags: ['golang', 'javascript'],
  },
];

const saveFeedFixtures = async (): Promise<void> => {
  await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
  await saveFixtures(con, AdvancedSettings, advancedSettings);
  await saveFixtures(con, FeedAdvancedSettings, [
    { feedId: '1', advancedSettingsId: 'tm' },
    { feedId: '1', advancedSettingsId: 'rn', disabled: true },
  ]);
  await saveFixtures(con, Category, categories);
  await saveFixtures(con, FeedTag, [
    { feedId: '1', tag: 'html' },
    { feedId: '1', tag: 'javascript' },
    { feedId: '1', tag: 'golang', blocked: true },
  ]);
  await saveFixtures(con, FeedSource, [
    { feedId: '1', sourceId: 'b' },
    { feedId: '1', sourceId: 'c' },
  ]);
};

const feedFields = `
pageInfo {
  endCursor
  hasNextPage
}
edges {
  node {
    id
    url
    title
    readTime
    tags
    source {
      id
      name
      image
      public
    }
  }
}`;

describe('query anonymousFeed', () => {
  const variables = {
    ranking: Ranking.POPULARITY,
    first: 10,
  };

  const QUERY = `
  query AnonymousFeed($filters: FiltersInput, $ranking: Ranking, $first: Int, $version: Int) {
    anonymousFeed(filters: $filters, ranking: $ranking, first: $first, version: $version) {
      ${feedFields}
    }
  }
`;

  it('should return anonymous feed with no filters ordered by popularity', async () => {
    const res = await client.query({ query: QUERY, variables });
    expect(res.data).toMatchSnapshot();
  });

  it('should return anonymous feed with no filters ordered by time', async () => {
    const res = await client.query({
      query: QUERY,
      variables: { ...variables, ranking: Ranking.TIME },
    });
    delete res.data.anonymousFeed.pageInfo.endCursor;
    expect(res.data).toMatchSnapshot();
  });

  it('should return anonymous feed filtered by sources', async () => {
    const res = await client.query({
      query: QUERY,
      variables: { ...variables, filters: { includeSources: ['a', 'b'] } },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should return anonymous feed filtered by tags', async () => {
    const res = await client.query({
      query: QUERY,
      variables: { ...variables, filters: { includeTags: ['html', 'webdev'] } },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should return anonymous feed while excluding sources', async () => {
    const res = await client.query({
      query: QUERY,
      variables: { ...variables, filters: { excludeSources: ['a'] } },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should return anonymous feed filtered by tags and sources', async () => {
    const res = await client.query({
      query: QUERY,
      variables: {
        ...variables,
        filters: {
          includeTags: ['javascript'],
          includeSources: ['a', 'b'],
        },
      },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should remove banned posts from the feed', async () => {
    await con.getRepository(Post).update({ id: 'p5' }, { banned: true });
    const res = await client.query({ query: QUERY, variables });
    expect(res.data).toMatchSnapshot();
  });

  it('should return anonymous feed v2', async () => {
    nock('http://localhost:6000')
      .get('/feed.json?token=token&page_size=11&fresh_page_size=4')
      .reply(200, {
        data: [{ post_id: 'p1' }, { post_id: 'p4' }],
      });
    const res = await client.query({
      query: QUERY,
      variables: { ...variables, version: 2 },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should safetly handle a case where the feed is empty', async () => {
    nock('http://localhost:6000')
      .get('/feed.json?token=token&page_size=11&fresh_page_size=4')
      .reply(200, {
        data: [],
      });
    const res = await client.query({
      query: QUERY,
      variables: { ...variables, version: 2 },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });
});

describe('query feed', () => {
  const variables = {
    ranking: Ranking.POPULARITY,
    first: 10,
  };

  const QUERY = `
  query Feed($ranking: Ranking, $first: Int, $version: Int, $unreadOnly: Boolean) {
    feed(ranking: $ranking, first: $first, version: $version, unreadOnly: $unreadOnly) {
      ${feedFields}
    }
  }
`;

  it('should not authorize when not logged-in', () =>
    testQueryErrorCode(client, { query: QUERY, variables }, 'UNAUTHENTICATED'));

  it('should return feed with preconfigured filters', async () => {
    loggedUser = '1';
    await saveFeedFixtures();
    const res = await client.query({ query: QUERY, variables });
    expect(res.data).toMatchSnapshot();
  });

  it('should return preconfigured feed with tags filters only', async () => {
    loggedUser = '1';
    await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
    await saveFixtures(con, FeedTag, [{ feedId: '1', tag: 'html' }]);
    const res = await client.query({ query: QUERY, variables });
    expect(res.data).toMatchSnapshot();
  });

  it('should return preconfigured feed with blocked tags filters only', async () => {
    loggedUser = '1';
    await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
    await saveFixtures(con, FeedTag, [
      { feedId: '1', tag: 'html', blocked: true },
    ]);
    const res = await client.query({ query: QUERY, variables });
    expect(res.data).toMatchSnapshot();
  });

  it('should return preconfigured feed with tags and blocked tags filters', async () => {
    loggedUser = '1';
    await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
    await saveFixtures(con, FeedTag, [
      { feedId: '1', tag: 'javascript' },
      { feedId: '1', tag: 'webdev', blocked: true },
    ]);
    const res = await client.query({ query: QUERY, variables });
    expect(res.data).toMatchSnapshot();
  });

  it('should return preconfigured feed with sources filters only', async () => {
    loggedUser = '1';
    await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
    await saveFixtures(con, FeedSource, [{ feedId: '1', sourceId: 'a' }]);
    const res = await client.query({ query: QUERY, variables });
    expect(res.data).toMatchSnapshot();
  });

  it('should return preconfigured feed with no filters', async () => {
    loggedUser = '1';
    await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
    const res = await client.query({ query: QUERY, variables });
    expect(res.data).toMatchSnapshot();
  });

  it('should return unread posts from preconfigured feed', async () => {
    loggedUser = '1';
    await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
    await con.getRepository(View).save([{ userId: '1', postId: 'p1' }]);
    const res = await client.query({
      query: QUERY,
      variables: { ...variables, unreadOnly: true },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should remove banned posts from the feed', async () => {
    loggedUser = '1';
    await saveFeedFixtures();
    await con.getRepository(Post).update({ id: 'p4' }, { banned: true });
    const res = await client.query({ query: QUERY });
    expect(res.data).toMatchSnapshot();
  });

  it('should remove deleted posts from the feed', async () => {
    loggedUser = '1';
    await saveFeedFixtures();
    await con.getRepository(Post).update({ id: 'p4' }, { deleted: true });
    const res = await client.query({ query: QUERY });
    expect(res.data).toMatchSnapshot();
  });

  it('should return feed v2', async () => {
    loggedUser = '1';
    await con.getRepository(Feed).save({ id: '1', userId: '1' });
    await con.getRepository(FeedTag).save([
      { feedId: '1', tag: 'javascript' },
      { feedId: '1', tag: 'golang' },
      { feedId: '1', tag: 'python', blocked: true },
      { feedId: '1', tag: 'java', blocked: true },
    ]);
    await con.getRepository(FeedSource).save([
      { feedId: '1', sourceId: 'a' },
      { feedId: '1', sourceId: 'b' },
    ]);
    nock('http://localhost:6000')
      .get(
        '/feed.json?token=token&page_size=11&fresh_page_size=4&user_id=1&allowed_tags=javascript,golang&blocked_tags=python,java&blocked_sources=a,b',
      )
      .reply(200, {
        data: [{ post_id: 'p1' }, { post_id: 'p4' }],
      });
    const res = await client.query({
      query: QUERY,
      variables: { ...variables, version: 2 },
    });
    expect(res.data).toMatchSnapshot();
  });
});

describe('query sourceFeed', () => {
  const QUERY = (
    source: string,
    ranking: Ranking = Ranking.POPULARITY,
    now = new Date(),
    first = 10,
  ): string => `{
    sourceFeed(source: "${source}", ranking: ${ranking}, now: "${now.toISOString()}", first: ${first}) {
      ${feedFields}
    }
  }`;

  it('should return a single source feed', async () => {
    const res = await client.query({ query: QUERY('b') });
    expect(res.data).toMatchSnapshot();
  });
});

describe('query tagFeed', () => {
  const QUERY = (
    tag: string,
    ranking: Ranking = Ranking.POPULARITY,
    now = new Date(),
    first = 10,
  ): string => `{
    tagFeed(tag: "${tag}", ranking: ${ranking}, now: "${now.toISOString()}", first: ${first}) {
      ${feedFields}
    }
  }`;

  it('should return a single tag feed', async () => {
    const res = await client.query({ query: QUERY('javascript') });
    expect(res.data).toMatchSnapshot();
  });
});

describe('query keywordFeed', () => {
  const QUERY = (
    keyword: string,
    ranking: Ranking = Ranking.POPULARITY,
    first = 10,
  ): string => `{
    keywordFeed(keyword: "${keyword}", ranking: ${ranking}, first: ${first}) {
      ${feedFields}
    }
  }`;

  it('should return a single keyword feed', async () => {
    const res = await client.query({ query: QUERY('javascript') });
    expect(res.data).toMatchSnapshot();
  });
});

describe('query feedSettings', () => {
  const QUERY = `{
    feedSettings {
      id
      userId
      includeTags
      blockedTags
      excludeSources {
        id
        name
        image
        public
      }
      advancedSettings {
        advancedSettingsId
        title
        description
        disabled
      }
    }
  }`;

  it('should not authorize when not logged-in', () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

  it('should return the feed settings', async () => {
    loggedUser = '1';
    await saveFeedFixtures();
    const res = await client.query({ query: QUERY });
    expect(res.data).toMatchSnapshot();
  });
});

describe('query searchPostSuggestions', () => {
  const QUERY = (query: string): string => `{
    searchPostSuggestions(query: "${query}") {
      query
      hits {
        title
      }
    }
  }
`;

  it('should return search suggestions', async () => {
    const res = await client.query({ query: QUERY('p1') });
    expect(res.data).toMatchSnapshot();
  });
});

describe('query searchPosts', () => {
  const QUERY = (query: string, now = new Date(), first = 10): string => `{
    searchPosts(query: "${query}", now: "${now.toISOString()}", first: ${first}) {
      query
      ${feedFields}
    }
  }
`;

  it('should return search feed', async () => {
    const res = await client.query({ query: QUERY('p1') });
    expect(res.data).toMatchSnapshot();
  });

  it('should return search empty feed', async () => {
    const res = await client.query({ query: QUERY('not found') });
    expect(res.data).toMatchSnapshot();
  });
});

describe('query rssFeeds', () => {
  const QUERY = `{
    rssFeeds {
      name, url
    }
  }`;

  it('should not authorize when not logged-in', () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

  it('should return rss feeds', async () => {
    loggedUser = '1';
    const list = await con
      .getRepository(BookmarkList)
      .save({ userId: loggedUser, name: 'list' });
    const res = await client.query({ query: QUERY });
    expect(res.data.rssFeeds).toEqual([
      { name: 'Recent news feed', url: 'http://localhost:4000/rss/f/1' },
      { name: 'Bookmarks', url: 'http://localhost:4000/rss/b/1' },
      {
        name: 'list',
        url: `http://localhost:4000/rss/b/l/${list.id.replace(/-/g, '')}`,
      },
    ]);
  });
});

describe('query authorFeed', () => {
  const QUERY = (
    author: string,
    ranking: Ranking = Ranking.POPULARITY,
    first = 10,
  ): string => `{
    authorFeed(author: "${author}", ranking: ${ranking}, first: ${first}) {
      ${feedFields}
    }
  }`;

  it('should return a single author feed', async () => {
    await con.getRepository(User).save([
      {
        id: '1',
        name: 'Ido',
        image: 'https://daily.dev/ido.jpg',
        twitter: 'idoshamun',
      },
    ]);
    await con
      .getRepository(Post)
      .update({ id: In(['p1', 'p3']) }, { authorId: '1' });

    const res = await client.query({ query: QUERY('1') });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });
});

describe('query mostUpvotedFeed', () => {
  const QUERY = (period = 7, first = 10): string => `{
    mostUpvotedFeed(first: ${first}, period: ${period}) {
      ${feedFields}
    }
  }`;

  it('should return a most upvoted feed', async () => {
    const repo = con.getRepository(Post);
    const now = new Date();
    await repo.update({ id: 'p1' }, { upvotes: 20 });
    await repo.update({ id: 'p3' }, { upvotes: 15 });
    await repo.update(
      { id: 'p2' },
      {
        upvotes: 30,
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 10),
      },
    );

    const res = await client.query({ query: QUERY() });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });

  it('should return a most upvoted feed of the month', async () => {
    const repo = con.getRepository(Post);
    const now = new Date();
    await repo.update({ id: 'p1' }, { upvotes: 20 });
    await repo.update({ id: 'p3' }, { upvotes: 15 });
    await repo.update(
      { id: 'p2' },
      {
        upvotes: 30,
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 10),
      },
    );

    const res = await client.query({ query: QUERY(30) });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });
});

describe('query mostDiscussedFeed', () => {
  const QUERY = (first = 10): string => `{
    mostDiscussedFeed(first: ${first}) {
      ${feedFields}
    }
  }`;

  it('should return a most discussed feed', async () => {
    const repo = con.getRepository(Post);
    await repo.update({ id: 'p1' }, { discussionScore: 20 });
    await repo.update({ id: 'p3' }, { discussionScore: 15 });

    const res = await client.query({ query: QUERY() });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });
});

describe('query randomTrendingPosts', () => {
  const QUERY = `query RandomTrendingPosts($first: Int, $post: ID) {
    randomTrendingPosts(first: $first, post: $post) {
      id
    }
  }`;

  beforeEach(async () => {
    const repo = con.getRepository(Post);
    await repo.update({ id: 'p1' }, { trending: 20 });
    await repo.update({ id: 'p3' }, { trending: 50 });
  });

  it('should return random trending posts', async () => {
    const res = await client.query({ query: QUERY, variables: { first: 10 } });
    expect(res.errors).toBeFalsy();
    expect(res.data.randomTrendingPosts.map((post) => post.id).sort()).toEqual([
      'p1',
      'p3',
    ]);
  });

  it('should filter out the given post', async () => {
    const res = await client.query({
      query: QUERY,
      variables: { first: 10, post: 'p1' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.randomTrendingPosts.map((post) => post.id).sort()).toEqual([
      'p3',
    ]);
  });
});

describe('query randomSimilarPosts', () => {
  const QUERY = (first = 10): string => `{
    randomSimilarPosts(post: "p1", first: ${first}) {
      id
    }
  }`;

  it('should return random similar posts', async () => {
    const repo = con.getRepository(Post);
    await repo.update({}, { upvotes: 5 });
    const now = new Date();
    await con.getRepository(Keyword).save([
      { value: 'javascript', status: 'allow' },
      { value: 'webdev', status: 'deny' },
      { value: 'backend', status: 'allow' },
    ]);
    await con.getRepository(PostKeyword).save([
      { keyword: 'backend', postId: 'p2' },
      { keyword: 'javascript', postId: 'p3' },
    ]);
    await repo.update(
      { id: 'p4' },
      {
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30 * 8),
      },
    );

    const res = await client.query({ query: QUERY() });
    expect(res.errors).toBeFalsy();
    expect(res.data.randomSimilarPosts.map((post) => post.id).sort()).toEqual([
      'p3',
      'p5',
    ]);
  });
});

describe('query randomSimilarPostsByTags', () => {
  const QUERY = `query RandomSimilarPostsByTags($post: ID, $tags: [String]!, $first: Int) {
    randomSimilarPostsByTags(post: $post, first: $first, tags: $tags) {
      id
    }
  }`;

  it('should return random similar posts by tags', async () => {
    const repo = con.getRepository(Post);
    const now = new Date();
    await con.getRepository(Keyword).save([
      { value: 'javascript', status: 'allow' },
      { value: 'webdev', status: 'deny' },
      { value: 'backend', status: 'allow' },
    ]);
    await con.getRepository(PostKeyword).save([
      { keyword: 'backend', postId: 'p2' },
      { keyword: 'javascript', postId: 'p3' },
    ]);
    await repo.update(
      { id: 'p4' },
      {
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30 * 8),
      },
    );

    const res = await client.query({
      query: QUERY,
      variables: { post: 'p1', tags: ['webdev', 'javascript'] },
    });
    expect(res.errors).toBeFalsy();
    expect(
      res.data.randomSimilarPostsByTags.map((post) => post.id).sort(),
    ).toEqual(['p3', 'p5']);
  });

  it('should return random similar posts even when tags not provided', async () => {
    const repo = con.getRepository(Post);
    const now = new Date();
    await con.getRepository(Keyword).save([
      { value: 'javascript', status: 'allow' },
      { value: 'webdev', status: 'deny' },
      { value: 'backend', status: 'allow' },
    ]);
    await con.getRepository(PostKeyword).save([
      { keyword: 'backend', postId: 'p2' },
      { keyword: 'javascript', postId: 'p3' },
    ]);
    await repo.update(
      { id: 'p4' },
      {
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30 * 8),
      },
    );

    const res = await client.query({
      query: QUERY,
      variables: { post: 'p1', tags: [] },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.randomSimilarPostsByTags.length).toEqual(3);
  });
});

describe('query randomDiscussedPosts', () => {
  const QUERY = `query RandomDiscussedPosts($first: Int, $post: ID) {
    randomDiscussedPosts(first: $first, post: $post) {
      id
    }
  }`;

  beforeEach(async () => {
    const repo = con.getRepository(Post);
    await repo.update({ id: 'p1' }, { discussionScore: 20, comments: 10 });
    await repo.update({ id: 'p3' }, { discussionScore: 50, comments: 15 });
  });

  it('should return random discussed posts', async () => {
    const res = await client.query({ query: QUERY, variables: { first: 10 } });
    expect(res.errors).toBeFalsy();
    expect(res.data.randomDiscussedPosts.map((post) => post.id).sort()).toEqual(
      ['p1', 'p3'],
    );
  });

  it('should filter out the given post', async () => {
    const res = await client.query({
      query: QUERY,
      variables: { first: 10, post: 'p1' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.randomDiscussedPosts.map((post) => post.id).sort()).toEqual(
      ['p3'],
    );
  });
});

describe('query tagsCategories', () => {
  it('should return a list of categories with a property of a string array as tags', async () => {
    const QUERY = `{
      tagsCategories {
        categories {
          id
          title
          tags
          emoji
        }
      }
    }`;

    await saveFeedFixtures();

    const res = await client.query({ query: QUERY });

    expect(res.data).toMatchSnapshot();
  });
});

describe('mutation addFiltersToFeed', () => {
  const MUTATION = `
  mutation AddFiltersToFeed($filters: FiltersInput!) {
    addFiltersToFeed(filters: $filters) {
      id
      userId
      includeTags
      blockedTags
      excludeSources {
        id
        name
        image
        public
      }
      advancedSettings {
        advancedSettingsId
        title
        description
        disabled
      }
    }
  }`;

  it('should not authorize when not logged-in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { filters: { excludeSources: ['a'] } },
      },
      'UNAUTHENTICATED',
    ));

  it('should add the new feed settings', async () => {
    loggedUser = '1';
    await redisClient.set(`${getPersonalizedFeedKey('2', '1')}:time`, '1');
    await redisClient.set(`${getPersonalizedFeedKey('2', '2')}:time`, '2');
    await saveFixtures(con, Feed, [{ id: '2', userId: '1' }]);
    await saveFixtures(con, AdvancedSettings, advancedSettings);
    const res = await client.mutate({
      mutation: MUTATION,
      variables: {
        filters: {
          includeTags: ['webdev', 'javascript'],
          excludeSources: ['a', 'b'],
          blockedTags: ['golang'],
          enabledAdvancedSettings: ['tm'],
          disabledAdvancedSettings: ['rn'],
        },
      },
    });
    expect(res.data).toMatchSnapshot();
    expect(
      await redisClient.get(`${getPersonalizedFeedKey('2', '1')}:time`),
    ).toBeFalsy();
    expect(
      await redisClient.get(`${getPersonalizedFeedKey('2', '2')}:time`),
    ).toEqual('2');
  });

  it('should ignore duplicates', async () => {
    loggedUser = '1';
    await saveFeedFixtures();
    const res = await client.mutate({
      mutation: MUTATION,
      variables: {
        filters: {
          includeTags: ['webdev', 'javascript'],
          excludeSources: ['a', 'b'],
          blockedTags: ['golang'],
          enabledAdvancedSettings: ['tm'],
          disabledAdvancedSettings: ['rn'],
        },
      },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should ignore non existing sources', async () => {
    loggedUser = '1';
    const res = await client.mutate({
      mutation: MUTATION,
      variables: {
        filters: {
          includeTags: ['webdev', 'javascript'],
          excludeSources: ['a', 'b', 'deleted'],
        },
      },
    });
    expect(res.data).toMatchSnapshot();
  });
});

describe('mutation removeFiltersFromFeed', () => {
  const MUTATION = `
  mutation RemoveFiltersFromFeed($filters: FiltersInput!) {
    removeFiltersFromFeed(filters: $filters) {
      id
      userId
      includeTags
      blockedTags
      excludeSources {
        id
        name
        image
        public
      }
      advancedSettings {
        advancedSettingsId
        title
        description
        disabled
      }
    }
  }`;

  it('should not authorize when not logged-in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { filters: { excludeSources: ['a'] } },
      },
      'UNAUTHENTICATED',
    ));

  it('should remove existing filters', async () => {
    loggedUser = '1';
    await redisClient.set(`${getPersonalizedFeedKey('2', '1')}:time`, '1');
    await redisClient.set(`${getPersonalizedFeedKey('2', '2')}:time`, '2');
    await saveFeedFixtures();
    const res = await client.mutate({
      mutation: MUTATION,
      variables: {
        filters: {
          includeTags: ['webdev', 'javascript'],
          excludeSources: ['a', 'b'],
          blockedTags: ['golang'],
          enabledAdvancedSettings: ['tm'],
          disabledAdvancedSettings: ['rn'],
        },
      },
    });
    expect(res.data).toMatchSnapshot();
    expect(
      await redisClient.get(`${getPersonalizedFeedKey('2', '1')}:time`),
    ).toBeFalsy();
    expect(
      await redisClient.get(`${getPersonalizedFeedKey('2', '2')}:time`),
    ).toEqual('2');
  });
});

describe('compatibility routes', () => {
  describe('GET /posts/latest', () => {
    it('should return anonymous feed with no filters ordered by popularity', async () => {
      const res = await request(app.server)
        .get('/v1/posts/latest')
        .query({ latest: new Date(), pageSize: 2, page: 0 })
        .send()
        .expect(200);
      expect(res.body.map((x) => _.pick(x, ['id']))).toMatchSnapshot();
    });

    it('should return anonymous feed filtered by sources', async () => {
      const res = await request(app.server)
        .get('/v1/posts/latest')
        .query({ latest: new Date(), sources: ['a', 'b'] })
        .send()
        .expect(200);
      expect(res.body.map((x) => _.pick(x, ['id']))).toMatchSnapshot();
    });

    it('should return anonymous feed filtered by tags', async () => {
      const res = await request(app.server)
        .get('/v1/posts/latest')
        .query({ latest: new Date(), tags: ['html', 'webdev'] })
        .send()
        .expect(200);
      expect(res.body.map((x) => _.pick(x, ['id']))).toMatchSnapshot();
    });

    it('should return anonymous feed filtered by tags and sources', async () => {
      const res = await request(app.server)
        .get('/v1/posts/latest')
        .query({
          latest: new Date(),
          tags: ['javascript'],
          sources: ['a', 'b'],
        })
        .send()
        .expect(200);
      expect(res.body.map((x) => _.pick(x, ['id']))).toMatchSnapshot();
    });

    it('should return preconfigured feed when logged-in', async () => {
      await saveFeedFixtures();
      const res = await authorizeRequest(
        request(app.server)
          .get('/v1/posts/latest')
          .query({ latest: new Date() }),
      )
        .send()
        .expect(200);
      expect(res.body.map((x) => _.pick(x, ['id']))).toMatchSnapshot();
    });
  });

  describe('GET /posts/publication', () => {
    it('should return single source feed', async () => {
      const res = await request(app.server)
        .get('/v1/posts/publication')
        .query({ latest: new Date(), pub: 'b' })
        .send()
        .expect(200);
      expect(res.body.map((x) => _.pick(x, ['id']))).toMatchSnapshot();
    });
  });

  describe('GET /posts/tag', () => {
    it('should return single tag feed', async () => {
      const res = await request(app.server)
        .get('/v1/posts/tag')
        .query({ latest: new Date(), tag: 'javascript' })
        .send()
        .expect(200);
      expect(res.body.map((x) => _.pick(x, ['id']))).toMatchSnapshot();
    });
  });

  describe('GET /feeds/publications', () => {
    it('should return feed publications filters', async () => {
      await saveFeedFixtures();
      const res = await authorizeRequest(
        request(app.server).get('/v1/feeds/publications'),
      ).expect(200);
      expect(res.body).toMatchSnapshot();
    });
  });

  describe('POST /feeds/publications', () => {
    it('should add new feed publications filters', async () => {
      const res = await authorizeRequest(
        request(app.server).post('/v1/feeds/publications'),
      )
        .send([
          { publicationId: 'a', enabled: false },
          { publicationId: 'b', enabled: false },
        ])
        .expect(200);
      expect(res.body).toMatchSnapshot();
    });

    it('should remove existing feed publications filters', async () => {
      await saveFeedFixtures();
      const res = await authorizeRequest(
        request(app.server).post('/v1/feeds/publications'),
      )
        .send([{ publicationId: 'b', enabled: true }])
        .expect(200);
      expect(res.body).toMatchSnapshot();
    });
  });

  describe('GET /feeds/tags', () => {
    it('should return feed tags filters', async () => {
      await saveFeedFixtures();
      const res = await authorizeRequest(
        request(app.server).get('/v1/feeds/tags'),
      ).expect(200);
      expect(res.body).toMatchSnapshot();
    });
  });

  describe('POST /feeds/tags', () => {
    it('should add new feed tags filters', async () => {
      const res = await authorizeRequest(
        request(app.server).post('/v1/feeds/tags'),
      )
        .send([{ tag: 'html' }, { tag: 'javascript' }])
        .expect(200);
      expect(res.body).toMatchSnapshot();
    });
  });
  describe('DELETE /feeds/tags', () => {
    it('should remove existing feed tags filters', async () => {
      await saveFeedFixtures();
      const res = await authorizeRequest(
        request(app.server).delete('/v1/feeds/tags'),
      )
        .send({ tag: 'javascript' })
        .expect(200);
      expect(res.body).toMatchSnapshot();
    });
  });
});
