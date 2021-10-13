import {
  Keyword,
  KeywordCategory,
  KEYWORD_CATEGORY,
} from './../src/entity/Keyword';
import { Feed } from './../src/entity/Feed';
import { ApolloServer } from 'apollo-server-fastify';
import {
  ApolloServerTestClient,
  createTestClient,
} from 'apollo-server-testing';
import { Connection, getConnection } from 'typeorm';
import { FastifyInstance } from 'fastify';
import request from 'supertest';

import { Context } from '../src/Context';
import createApolloServer from '../src/apollo';
import {
  authorizeRequest,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import appFunc from '../src';
import { FeedTag, Settings } from '../src/entity';

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

const keywords: Partial<Keyword>[] = [
  { value: 'html', categories: ['Frontend'] },
  { value: 'javascript', categories: ['Frontend', 'Backend'] },
  { value: 'golang', categories: ['Backend'] },
];
const feedTags = [
  { feedId: '1', tag: 'html' },
  { feedId: '1', tag: 'javascript' },
  { feedId: '1', tag: 'golang', blocked: true },
];

const saveFeedFixtures = async (): Promise<void> => {
  await saveFixtures(con, Keyword, keywords);
  await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
  await saveFixtures(con, FeedTag, feedTags);
};

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

    const res = await client.query({ query: QUERY });
    expect(res.data.userSettings).toEqual(expected);
  });

  it('should create default settings if not exist', async () => {
    loggedUser = '1';
    const res = await client.query({ query: QUERY });
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
      const expected = new Object(await repo.save(settings));
      expected['showOnlyNotReadPosts'] = expected['showOnlyUnreadPosts'];
      delete expected['updatedAt'];
      delete expected['showOnlyUnreadPosts'];

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

describe('query tagCategories', () => {
  it('should return a list of categories having key as a unique identifier and title with some cute emojis!', async () => {
    const QUERY = `{
      tagCategories {
        categories {
          key
          title
        }
      }
    }`;

    await saveFeedFixtures();

    const res = await client.query({ query: QUERY });

    expect(res.data.tagCategories.categories.length).toEqual(
      Object.keys(KEYWORD_CATEGORY).length,
    );
  });
});

describe('query categoryTags', () => {
  const FE_IN_FIXTURES = keywords.filter((keyword) =>
    keyword.categories.some(
      (category: KeywordCategory) => category === 'Frontend',
    ),
  );
  const BE_IN_FIXTURES = keywords.filter((keyword) =>
    keyword.categories.some(
      (category: KeywordCategory) => category === 'Backend',
    ),
  );
  const BLOCKED_IN_FIXTURES = feedTags.filter((feedTag) => feedTag.blocked);

  it('should return a list of tags under the provided category', async () => {
    loggedUser = '1';

    const getQuery = (category: KeywordCategory) => `{
      categoryTags(category: "${category}") {
        keywords {
          name,
          blocked
        }
      }
    }`;

    await saveFeedFixtures();

    const res1 = await client.query({ query: getQuery('Frontend') });

    expect(res1.data.categoryTags.keywords.length).toEqual(
      FE_IN_FIXTURES.length,
    );

    const res2 = await client.query({ query: getQuery('Backend') });

    expect(res2.data.categoryTags.keywords.length).toEqual(
      BE_IN_FIXTURES.length,
    );

    const blockedTags = res2.data.categoryTags.keywords.filter(
      (tag: FeedTag) => tag.blocked,
    );
    expect(blockedTags.length).toEqual(BLOCKED_IN_FIXTURES.length);
  });
});
