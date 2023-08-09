import { FastifyInstance } from 'fastify';
import request from 'supertest';
import _ from 'lodash';

import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import {
  Bookmark,
  Post,
  PostTag,
  Source,
  View,
  BookmarkList,
  ArticlePost,
} from '../src/entity';
import { sourcesFixture } from './fixture/source';
import { postsFixture, postTagsFixture } from './fixture/post';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';

let app: FastifyInstance;
let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string;
let premiumUser: boolean;

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

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser, premiumUser),
  );
  client = state.client;
  app = state.app;
});

beforeEach(async () => {
  loggedUser = null;
  premiumUser = false;

  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await saveFixtures(con, PostTag, postTagsFixture);
});

afterAll(() => disposeGraphQLTesting(state));

describe('mutation addBookmarks', () => {
  const MUTATION = `
  mutation AddBookmarks($data: AddBookmarkInput!) {
  addBookmarks(data: $data) {
    _
  }
}`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { data: { postIds: [] } },
      },
      'UNAUTHENTICATED',
    ));

  it('should add new bookmarks', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { data: { postIds: ['p1', 'p3'] } },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con
      .getRepository(Bookmark)
      .find({ where: { userId: loggedUser }, select: ['postId', 'userId'] });
    expect(actual).toMatchSnapshot();
  });

  it('should ignore conflicts', async () => {
    loggedUser = '1';
    const repo = con.getRepository(Bookmark);
    await repo.save(repo.create({ postId: 'p1', userId: loggedUser }));
    const res = await client.mutate(MUTATION, {
      variables: { data: { postIds: ['p1', 'p3'] } },
    });
    expect(res.errors).toBeFalsy();
    const actual = await repo.find({
      where: { userId: loggedUser },
      select: ['postId', 'userId'],
    });
    expect(actual).toMatchSnapshot();
  });

  it('should ignore bookmarks of deleted posts', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { data: { postIds: ['p1', 'p3', 'p100'] } },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con
      .getRepository(Bookmark)
      .find({ where: { userId: loggedUser }, select: ['postId', 'userId'] });
    expect(actual).toMatchSnapshot();
  });

  it('should ignore nulls', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { data: { postIds: ['p1', null, 'p3'] } },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con
      .getRepository(Bookmark)
      .find({ where: { userId: loggedUser }, select: ['postId', 'userId'] });
    expect(actual).toMatchSnapshot();
  });
});

describe('mutation removeBookmark', () => {
  const MUTATION = (id: string): string => `
  mutation RemoveBookmark {
  removeBookmark(id: "${id}") {
    _
  }
}`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION('2'),
      },
      'UNAUTHENTICATED',
    ));

  it('should remove existing bookmark', async () => {
    loggedUser = '1';
    const repo = con.getRepository(Bookmark);
    await repo.save(repo.create({ postId: 'p1', userId: loggedUser }));
    const res = await client.mutate(MUTATION('p1'));
    expect(res.errors).toBeFalsy();
    const actual = await repo.find({
      where: { userId: loggedUser },
      select: ['postId', 'userId'],
    });
    expect(actual.length).toEqual(0);
  });

  it('should ignore remove non-existing bookmark', async () => {
    loggedUser = '1';
    const repo = con.getRepository(Bookmark);
    const res = await client.mutate(MUTATION('p1'));
    expect(res.errors).toBeFalsy();
    const actual = await repo.find({
      where: { userId: loggedUser },
      select: ['postId', 'userId'],
    });
    expect(actual.length).toEqual(0);
  });
});

describe('mutation createBookmarkList', () => {
  const MUTATION = (name: string): string => `
  mutation CreateBookmarkList {
  createBookmarkList(name: "${name}") {
    id, name
  }
}`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION('list'),
      },
      'UNAUTHENTICATED',
    ));

  it('should not authorize when not premium user', () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION('list'),
      },
      'FORBIDDEN',
    );
  });

  it('should create a new list', async () => {
    loggedUser = '1';
    premiumUser = true;
    const res = await client.mutate(MUTATION('list'));
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(BookmarkList).find();
    expect(actual.length).toEqual(1);
    expect(res.data.createBookmarkList.id).toEqual(actual[0].id);
    expect(res.data.createBookmarkList.name).toEqual(actual[0].name);
    expect(actual[0].name).toEqual('list');
    expect(actual[0].userId).toEqual(loggedUser);
  });
});

describe('mutation removeBookmarkList', () => {
  const MUTATION = (id: string): string => `
  mutation RemoveBookmarkList {
  removeBookmarkList(id: "${id}") {
    _
  }
}`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION('123'),
      },
      'UNAUTHENTICATED',
    ));

  it('should not authorize when not premium user', () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION('123'),
      },
      'FORBIDDEN',
    );
  });

  it('should remove an existing list', async () => {
    loggedUser = '1';
    premiumUser = true;
    const repo = con.getRepository(BookmarkList);
    const list = await repo.save({ userId: loggedUser, name: 'list' });
    const res = await client.mutate(MUTATION(list.id));
    expect(res.errors).toBeFalsy();
    const actual = await repo.find();
    expect(actual.length).toEqual(0);
  });

  it("should not remove someone else's list", async () => {
    loggedUser = '1';
    premiumUser = true;
    const repo = con.getRepository(BookmarkList);
    const list = await repo.save({ userId: '2', name: 'list' });
    const res = await client.mutate(MUTATION(list.id));
    expect(res.errors).toBeFalsy();
    const actual = await repo.find();
    expect(actual.length).toEqual(1);
  });
});

describe('mutation renameBookmarkList', () => {
  const MUTATION = (id: string, name: string): string => `
  mutation RenameBookmarkList {
  renameBookmarkList(id: "${id}", name: "${name}") {
    id, name
  }
}`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION('123', 'list'),
      },
      'UNAUTHENTICATED',
    ));

  it('should not authorize when not premium user', () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION('123', 'list'),
      },
      'FORBIDDEN',
    );
  });

  it('should rename an existing list', async () => {
    loggedUser = '1';
    premiumUser = true;
    const repo = con.getRepository(BookmarkList);
    const list = await repo.save({ userId: loggedUser, name: 'list' });
    const res = await client.mutate(MUTATION(list.id, 'new'));
    expect(res.errors).toBeFalsy();
    const actual = await repo.find();
    expect(actual.length).toEqual(1);
    expect(res.data.renameBookmarkList.id).toEqual(actual[0].id);
    expect(res.data.renameBookmarkList.name).toEqual(actual[0].name);
    expect(actual[0].name).toEqual('new');
    expect(actual[0].userId).toEqual(loggedUser);
  });

  it("should not rename someone else's list", async () => {
    loggedUser = '1';
    premiumUser = true;
    const repo = con.getRepository(BookmarkList);
    const list = await repo.save({ userId: '2', name: 'list' });
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION(list.id, 'new'),
      },
      'NOT_FOUND',
    );
  });
});

describe('mutation addBookmarkToList', () => {
  const MUTATION = (id: string, listId?: string): string => `
  mutation AddBookmarkToList {
  addBookmarkToList(id: "${id}"${listId ? `, listId: "${listId}"` : ''}) {
    _
  }
}`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION('p1', 'list') },
      'UNAUTHENTICATED',
    ));

  it('should not authorize when not premium user', () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      { mutation: MUTATION('p1', 'list') },
      'FORBIDDEN',
    );
  });

  it('should add new bookmark to list', async () => {
    loggedUser = '1';
    premiumUser = true;
    const list = await con
      .getRepository(BookmarkList)
      .save({ userId: loggedUser, name: 'list' });
    const res = await client.mutate(MUTATION('p1', list.id));
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(Bookmark).find({
      where: { userId: loggedUser },
      select: ['postId', 'userId', 'listId'],
    });
    expect(actual.length).toEqual(1);
    expect(actual[0].postId).toEqual('p1');
    expect(actual[0].userId).toEqual('1');
    expect(actual[0].listId).toEqual(list.id);
  });

  it('should update exsiting bookmark', async () => {
    loggedUser = '1';
    premiumUser = true;
    const list = await con
      .getRepository(BookmarkList)
      .save({ userId: loggedUser, name: 'list' });
    const repo = con.getRepository(Bookmark);
    await repo.save(repo.create({ postId: 'p1', userId: loggedUser }));
    const res = await client.mutate(MUTATION('p1', list.id));
    expect(res.errors).toBeFalsy();
    const actual = await repo.find({
      where: { userId: loggedUser },
      select: ['postId', 'userId', 'listId'],
    });
    expect(actual.length).toEqual(1);
    expect(actual[0].postId).toEqual('p1');
    expect(actual[0].userId).toEqual('1');
    expect(actual[0].listId).toEqual(list.id);
  });

  it('should set list id to null', async () => {
    loggedUser = '1';
    premiumUser = true;
    const list = await con
      .getRepository(BookmarkList)
      .save({ userId: loggedUser, name: 'list' });
    const repo = con.getRepository(Bookmark);
    await repo.save(
      repo.create({ postId: 'p1', userId: loggedUser, listId: list.id }),
    );
    const res = await client.mutate(MUTATION('p1'));
    expect(res.errors).toBeFalsy();
    const actual = await repo.find({
      where: { userId: loggedUser },
      select: ['postId', 'userId', 'listId'],
    });
    expect(actual.length).toEqual(1);
    expect(actual[0].postId).toEqual('p1');
    expect(actual[0].userId).toEqual('1');
    expect(actual[0].listId).toEqual(null);
  });
});

describe('query bookmarks', () => {
  const QUERY = (
    unreadOnly?: boolean,
    listId?: string,
    now = new Date(),
    first = 10,
  ): string => `{
  bookmarksFeed(now: "${now.toISOString()}", first: ${first}${
    unreadOnly ? ', unreadOnly: true' : ''
  }${listId ? `, listId: "${listId}"` : ''}) {
    pageInfo {
      endCursor
      hasNextPage
    }
    edges {
      node {
        id
        source {
          id
          name
          image
          public
        }
        tags
      }
    }
  }
}`;

  it('should not authorize when not logged in', () =>
    testQueryErrorCode(
      client,
      {
        query: QUERY(),
      },
      'UNAUTHENTICATED',
    ));

  it('should return bookmarks ordered by time', async () => {
    loggedUser = '1';
    await saveFixtures(con, Bookmark, bookmarksFixture);
    const res = await client.query(QUERY(false, null, now, 2));
    delete res.data.bookmarksFeed.pageInfo.endCursor;
    expect(res.data).toMatchSnapshot();
  });

  it('should return unread bookmarks only', async () => {
    loggedUser = '1';
    await saveFixtures(con, Bookmark, bookmarksFixture);
    await con.getRepository(View).save([{ userId: '1', postId: 'p3' }]);
    const res = await client.query(QUERY(true, null, now, 2));
    delete res.data.bookmarksFeed.pageInfo.endCursor;
    expect(res.data).toMatchSnapshot();
  });

  it('should return bookmarks from list', async () => {
    loggedUser = '1';
    premiumUser = true;
    const list = await con
      .getRepository(BookmarkList)
      .save({ userId: loggedUser, name: 'list' });
    const repo = con.getRepository(Bookmark);
    await saveFixtures(con, Bookmark, bookmarksFixture);
    await repo.update(
      { postId: bookmarksFixture[0].postId },
      { listId: list.id },
    );
    await repo.update(
      { postId: bookmarksFixture[2].postId },
      { listId: list.id },
    );
    const res = await client.query(QUERY(false, list.id, now, 2));
    delete res.data.bookmarksFeed.pageInfo.endCursor;
    expect(res.data).toMatchSnapshot();
  });

  it('should include banned posts', async () => {
    loggedUser = '1';
    await saveFixtures(con, Bookmark, bookmarksFixture);
    await con.getRepository(Post).update({ id: 'p3' }, { banned: true });
    const res = await client.query(QUERY(false, null, now, 2));
    delete res.data.bookmarksFeed.pageInfo.endCursor;
    expect(res.data).toMatchSnapshot();
  });
});

describe('query bookmarksLists', () => {
  const QUERY = `{
    bookmarkLists {
      id, name
    }
  }`;

  it('should not authorize when not logged in', () =>
    testQueryErrorCode(
      client,
      {
        query: QUERY,
      },
      'UNAUTHENTICATED',
    ));

  it('should not authorize when not logged in', () => {
    loggedUser = '1';
    return testQueryErrorCode(
      client,
      {
        query: QUERY,
      },
      'FORBIDDEN',
    );
  });

  it('should return bookmark lists', async () => {
    loggedUser = '1';
    premiumUser = true;
    const list = await con
      .getRepository(BookmarkList)
      .save({ userId: loggedUser, name: 'list' });
    const res = await client.query(QUERY);
    delete list.userId;
    expect(res.data.bookmarkLists).toEqual([list]);
  });
});

describe('compatibility routes', () => {
  describe('POST /posts/bookmarks', () => {
    it('should return bad request when no body is provided', () => {
      loggedUser = '1';
      return request(app.server).post('/v1/posts/bookmarks').expect(500);
    });

    it('should add new bookmarks', async () => {
      loggedUser = '1';
      await request(app.server)
        .post('/v1/posts/bookmarks')
        .send(['p1', 'p3'])
        .expect(204);
      const actual = await con.getRepository(Bookmark).find({
        where: { userId: '1' },
        select: ['postId', 'userId'],
      });
      expect(actual).toMatchSnapshot();
    });
  });

  describe('POST /posts/:id/bookmarks', () => {
    it('should remove existing bookmark', async () => {
      const repo = con.getRepository(Bookmark);
      await repo.save(repo.create({ postId: 'p1', userId: '1' }));
      loggedUser = '1';
      await request(app.server)
        .delete('/v1/posts/p1/bookmark')
        .send()
        .expect(204);
      const actual = await repo.find({
        where: { userId: '1' },
        select: ['postId', 'userId'],
      });
      expect(actual.length).toEqual(0);
    });
  });

  describe('GET /posts/bookmarks', () => {
    it('should return bookmarks ordered by time', async () => {
      await saveFixtures(con, Bookmark, bookmarksFixture);
      loggedUser = '1';
      const res = await request(app.server)
        .get('/v1/posts/bookmarks')
        .query({ latest: now, pageSize: 2, page: 0 })
        .send()
        .expect(200);
      expect(res.body.map((x) => _.pick(x, ['id']))).toMatchSnapshot();
    });
  });
});

describe('query searchBookmarksSuggestions', () => {
  const QUERY = (query: string): string => `{
    searchBookmarksSuggestions(query: "${query}") {
      query
      hits {
        title
      }
    }
  }
`;

  it('should return bookmark search suggestions', async () => {
    loggedUser = '1';
    await saveFixtures(con, Bookmark, bookmarksFixture);
    const res = await client.query(QUERY('p1'));
    expect(res.data).toMatchSnapshot();
  });
});

describe('query searchBookmarks', () => {
  const QUERY = (query: string, now = new Date(), first = 10): string => `{
    searchBookmarks(query: "${query}", now: "${now.toISOString()}", first: ${first}) {
      query
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
      }
    }
  }
`;

  it('should return bookmarks search feed', async () => {
    loggedUser = '1';
    await saveFixtures(con, Bookmark, bookmarksFixture);
    const res = await client.query(QUERY('p1'));
    expect(res.data).toMatchSnapshot();
  });

  it('should return bookmarks search empty feed', async () => {
    loggedUser = '1';
    await saveFixtures(con, Bookmark, bookmarksFixture);
    const res = await client.query(QUERY('not found'));
    expect(res.data).toMatchSnapshot();
  });
});
