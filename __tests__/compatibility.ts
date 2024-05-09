import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
} from './helpers';
import {
  ArticlePost,
  Bookmark,
  Post,
  PostKeyword,
  Source,
  User,
} from '../src/entity';
import { sourcesFixture } from './fixture/source';
import { postKeywordsFixture, postsFixture } from './fixture/post';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { usersFixture } from './fixture/user';

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

  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await saveFixtures(con, PostKeyword, postKeywordsFixture);
});

afterAll(() => disposeGraphQLTesting(state));

const now = new Date();
const bookmarksFixture = [
  {
    userId: '1',
    postId: 'p3',
    createdAt: new Date(now.getTime() - 1000),
  },
  {
    userId: '1',
    postId: 'p1',
    createdAt: new Date(now.getTime() - 2000),
  },
  {
    userId: '1',
    postId: 'p5',
    createdAt: new Date(now.getTime() - 3000),
  },
];

const feedFields = `
    id
    url
    title
    readTime
    tags
    publication {
      id
      name
      image
    }
`;

describe('query latest', () => {
  const QUERY = `
  query Latest($params: QueryPostInput) {
    latest(params: $params) {
      ${feedFields}
    }
  }`;

  it('should return anonymous feed with no filters ordered by popularity', async () => {
    await con.getRepository(Post).delete({ id: 'p6' });
    const latest = new Date().toISOString();
    const res = await client.query(QUERY, {
      variables: { params: { latest } },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should return anonymous feed with no filters ordered by time', async () => {
    await con.getRepository(Post).delete({ id: 'p6' });
    const latest = new Date().toISOString();
    const res = await client.query(QUERY, {
      variables: { params: { latest, sortBy: 'creation' } },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should return anonymous feed filtered by sources', async () => {
    const latest = new Date().toISOString();
    const res = await client.query(QUERY, {
      variables: { params: { latest, pubs: 'a,b' } },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should return anonymous feed filtered by tags', async () => {
    const latest = new Date().toISOString();
    const res = await client.query(QUERY, {
      variables: { params: { latest, tags: 'html,webdev' } },
    });
    expect(res.data).toMatchSnapshot();
  });
});

describe('query bookmarks', () => {
  const QUERY = `
  query Bookmarks($params: QueryPostInput) {
    bookmarks(params: $params) {
      ${feedFields}
    }
  }`;

  beforeEach(async () => {
    await saveFixtures(con, User, usersFixture);
  });

  it('should return bookmarks ordered by time', async () => {
    const latest = new Date().toISOString();
    loggedUser = '1';
    await saveFixtures(con, Bookmark, bookmarksFixture);
    const res = await client.query(QUERY, {
      variables: { params: { latest } },
    });
    expect(res.data).toMatchSnapshot();
  });
});

describe('query postsByTag', () => {
  const QUERY = `
  query PostsByTag($params: PostByTagInput) {
    postsByTag(params: $params) {
      ${feedFields}
    }
  }`;

  it('should return a single tag feed', async () => {
    const latest = new Date().toISOString();
    const res = await client.query(QUERY, {
      variables: { params: { latest, tag: 'javascript' } },
    });
    expect(res.data).toMatchSnapshot();
  });
});
