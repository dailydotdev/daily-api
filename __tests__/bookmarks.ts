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
  User,
  Settings,
} from '../src/entity';
import { sourcesFixture, usersFixture, plusUsersFixture } from './fixture';
import { postsFixture, postTagsFixture } from './fixture/post';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { subDays } from 'date-fns';
import { GQLBookmark } from '../src/schema/bookmarks';
import { VALID_FOLDER_EMOJIS } from '../src/common';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string;
let premiumUser: boolean;
let isPlus: boolean;

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
    (req) =>
      new MockContext(con, loggedUser, premiumUser, [], req, false, isPlus),
  );
  client = state.client;
});

beforeEach(async () => {
  loggedUser = '';
  isPlus = false;

  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await saveFixtures(con, PostTag, postTagsFixture);
  await saveFixtures(con, User, [...usersFixture, ...plusUsersFixture]);
});

afterAll(() => disposeGraphQLTesting(state));

describe('mutation addBookmarks', () => {
  const MUTATION = `
  mutation AddBookmarks($data: AddBookmarkInput!) {
    addBookmarks(data: $data) {
      list {
        id
        name
      }
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
    const res = await client.mutate<
      {
        addBookmarks: GQLBookmark[];
      },
      {
        data: { postIds: string[] };
      }
    >(MUTATION, {
      variables: { data: { postIds: ['p1', 'p3'] } },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.addBookmarks).toHaveLength(2);

    const actual = await con
      .getRepository(Bookmark)
      .find({ where: { userId: loggedUser }, select: ['postId', 'userId'] });
    expect(actual).toMatchSnapshot();

    const bookmarks = await con.getRepository(Bookmark).find();
    expect(bookmarks.length).toEqual(2);
    const [bookmark] = bookmarks;
    expect(bookmark?.listId).toBeNull();
  });

  it('should add new bookmarks to the last used list if any', async () => {
    loggedUser = '1';

    const { id: listId } = await con.getRepository(BookmarkList).save({
      userId: loggedUser,
      name: 'list',
    });
    await con.getRepository(Bookmark).save({
      userId: loggedUser,
      postId: 'p1',
      listId: listId,
    });

    const res = await client.mutate(MUTATION, {
      variables: { data: { postIds: ['p2'] } },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.addBookmarks).toHaveLength(1);
    expect(res.data.addBookmarks[0].list.id).toEqual(listId);

    const actual = await con
      .getRepository(Bookmark)
      .findOneBy({ postId: 'p2', userId: loggedUser });
    expect(actual?.listId).toEqual(listId);
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

  it('should support EmptyResponse', async () => {
    const MUTATION_EMPTY_RESPONSE = `
    mutation AddBookmarks($data: AddBookmarkInput!) {
      addBookmarks(data: $data) {
        _
      }
    }`;

    loggedUser = '1';
    const res = await client.mutate<
      {
        addBookmarks: GQLBookmark[];
      },
      {
        data: { postIds: string[] };
      }
    >(MUTATION_EMPTY_RESPONSE, {
      variables: { data: { postIds: ['p1', 'p3'] } },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.addBookmarks).toMatchObject([{ _: null }, { _: null }]);

    const actual = await con
      .getRepository(Bookmark)
      .find({ where: { userId: loggedUser }, select: ['postId', 'userId'] });
    expect(actual).toMatchObject([
      {
        postId: 'p1',
        userId: '1',
      },
      {
        postId: 'p3',
        userId: '1',
      },
    ]);
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
  const MUTATION = (name: string, icon?: string): string => `
  mutation CreateBookmarkList {
  createBookmarkList(name: "${name}", ${icon ? `icon: "${icon}"` : ''}) {
    id, name, icon
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

  it('should create a new list', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION('list'));
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(BookmarkList).find();
    expect(actual.length).toEqual(1);
    expect(res.data.createBookmarkList.id).toEqual(actual[0].id);
    expect(res.data.createBookmarkList.name).toEqual(actual[0].name);
    expect(actual[0].name).toEqual('list');
    expect(actual[0].userId).toEqual(loggedUser);
  });

  it('should throw error if name is empty', async () => {
    loggedUser = '1';
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION(''),
      },
      'GRAPHQL_VALIDATION_FAILED',
      'Invalid icon or name',
    );
  });

  it('should throw error if icon is not a single emoji', async () => {
    loggedUser = '1';
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION('list', 'icon'),
      },
      'GRAPHQL_VALIDATION_FAILED',
      'Invalid icon or name',
    );
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION('list', '😂💯'),
      },
      'GRAPHQL_VALIDATION_FAILED',
      'Invalid icon or name',
    );
  });

  test.each(VALID_FOLDER_EMOJIS)(
    'should create a new list with icon %s',
    async (iconToTest: string) => {
      loggedUser = '1';
      const res = await client.mutate(MUTATION('list', iconToTest));
      expect(res.errors).toBeFalsy();
      const folders = await con.getRepository(BookmarkList).find();
      expect(folders.length).toEqual(1);
      const folder = folders[0];
      const { id, name, icon, userId } = folder;
      expect(res.data.createBookmarkList.id).toEqual(id);
      expect(res.data.createBookmarkList.name).toEqual(name);
      expect(res.data.createBookmarkList.icon).toEqual(icon);
      expect(name).toEqual('list');
      expect(icon).toEqual(iconToTest);
      expect(userId).toEqual(loggedUser);
    },
  );

  it('should not create a new list if already have one and user is not plus', async () => {
    loggedUser = '1';
    const repo = con.getRepository(BookmarkList);
    await repo.save({ userId: loggedUser, name: 'list' });
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION('list2'),
      },
      'FORBIDDEN',
    );
  });

  it('should create a new list if already have one and user is plus', async () => {
    loggedUser = '5'; // Plus member
    const repo = con.getRepository(BookmarkList);
    await repo.save({ userId: loggedUser, name: 'list' });
    const res = await client.mutate(MUTATION('list2'));
    expect(res.errors).toBeFalsy();
    const folders = await repo.find();
    expect(folders.length).toEqual(2);
    expect(res.data.createBookmarkList.name).toEqual('list2');
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

  it('should remove an existing list', async () => {
    loggedUser = '1';
    const repo = con.getRepository(BookmarkList);
    const list = await repo.save({ userId: loggedUser, name: 'list' });

    await con.getRepository(Bookmark).save([
      { postId: 'p1', userId: loggedUser, listId: list.id },
      { postId: 'p2', userId: loggedUser, listId: list.id },
    ]);

    const res = await client.mutate(MUTATION(list.id));
    expect(res.errors).toBeFalsy();
    const actual = await repo.find();
    expect(actual.length).toEqual(0);

    // check for cascade delete
    const bookmarks = await con.getRepository(Bookmark).find();
    expect(bookmarks.length).toEqual(0);
  });

  it("should not remove someone else's list", async () => {
    loggedUser = '1';
    const repo = con.getRepository(BookmarkList);
    const list = await repo.save({ userId: '2', name: 'list' });
    const res = await client.mutate(MUTATION(list.id));
    expect(res.errors).toBeFalsy();
    const actual = await repo.find();
    expect(actual.length).toEqual(1);
  });
});

describe('mutation updateBookmarkList', () => {
  const MUTATION = (id: string, name: string, icon?: string): string => `
    mutation UpdateBookmarkList {
      updateBookmarkList(id: "${id}", name: "${name}", ${icon ? `icon: "${icon}"` : ''}) {
        id, name, icon
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

  it("should not rename someone else's list", async () => {
    loggedUser = '1';
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

  it('should update an existing list name', async () => {
    loggedUser = '1';
    const repo = con.getRepository(BookmarkList);
    const list = await repo.save({
      userId: loggedUser,
      name: 'list',
      icon: '😀',
    });

    const res = await client.mutate(MUTATION(list.id, 'new'));
    expect(res.errors).toBeFalsy();
    const updateResult = res.data.updateBookmarkList;

    const folders = await repo.find();
    expect(folders.length).toEqual(1);

    const [folder] = folders;
    expect(updateResult.id).toEqual(folder.id);
    expect(updateResult.name).toEqual(folder.name);
    expect(folder.name).toEqual('new');
    expect(folder.userId).toEqual(loggedUser);
    expect(folder.icon).toEqual('😀'); // not changed
  });

  it('should update an existing list icon', async () => {
    loggedUser = '1';
    const repo = con.getRepository(BookmarkList);
    const list = await repo.save({
      userId: loggedUser,
      name: 'list',
      icon: '😀',
    });

    const res = await client.mutate(MUTATION(list.id, 'new', '👀'));
    expect(res.errors).toBeFalsy();
    const updateResult = res.data.updateBookmarkList;

    const folders = await repo.find();
    expect(folders.length).toEqual(1);

    const [folder] = folders;
    expect(updateResult.id).toEqual(folder.id);
    expect(updateResult.name).toEqual(folder.name);
    expect(folder.name).toEqual('new');
    expect(folder.userId).toEqual(loggedUser);
    expect(folder.icon).toEqual('👀'); // not changed
  });
});

describe('mutation moveBookmark', () => {
  const MUTATION = (id: string, listId?: string): string => `
  mutation moveBookmark {
    moveBookmark(id: "${id}"${listId ? `, listId: "${listId}"` : ''}) {
      _
    }
  }`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION('p1', 'list') },
      'UNAUTHENTICATED',
    ));

  it('should not authorize if list is not owned by the user', async () => {
    loggedUser = '1';
    const list = await con
      .getRepository(BookmarkList)
      .save({ userId: '2', name: 'list' });
    const bookmark = await con
      .getRepository(Bookmark)
      .save({ postId: 'p1', userId: '2' });
    return testMutationErrorCode(
      client,
      { mutation: MUTATION(bookmark.postId, list.id) },
      'NOT_FOUND',
    );
  });

  it('should update existing bookmark', async () => {
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
  const QUERY = `
    query BookmarksFeed($first: Int, $now: DateTime, $listId: ID, $reminderOnly: Boolean, $unreadOnly: Boolean) {
      bookmarksFeed(first: $first, now: $now, listId: $listId, reminderOnly: $reminderOnly, unreadOnly: $unreadOnly) {
        pageInfo {
          endCursor
          hasNextPage
        }
        edges {
          node {
            id
            bookmark {
              remindAt
              list {
                id
                name
              }
            }
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
    }
  `;

  it('should not authorize when not logged in', () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

  const saveBookmarkFixtures = (userId = loggedUser) =>
    saveFixtures(
      con,
      Bookmark,
      bookmarksFixture.map((b) => ({ ...b, userId })),
    );

  it('should return bookmarks ordered by time', async () => {
    loggedUser = '1';
    await saveFixtures(con, Bookmark, bookmarksFixture);
    const res = await client.query(QUERY, { variables: { first: 2, now } });
    delete res.data.bookmarksFeed.pageInfo.endCursor;
    expect(res.data).toMatchSnapshot();
  });

  it('should return bookmarks filtered with reminder only', async () => {
    loggedUser = '1';
    await saveFixtures(con, Bookmark, bookmarksFixture);
    await con
      .getRepository(Bookmark)
      .update({ userId: '1', postId: 'p1' }, { remindAt: new Date() });
    const res = await client.query(QUERY, {
      variables: { first: 2, now, reminderOnly: true },
    });
    expect(res.data.bookmarksFeed.edges.length).toBeGreaterThan(0);
    const isReminderOnly = res.data.bookmarksFeed.edges.every(
      ({ node }) => node.bookmark.remindAt,
    );
    expect(isReminderOnly).toBeTruthy();
  });

  describe('plus user', () => {
    beforeEach(async () => {
      loggedUser = '5';
      isPlus = true;
      await con.getRepository(Settings).save({ userId: loggedUser });
    });

    it('should return bookmarks without list id only as plus user', async () => {
      await saveBookmarkFixtures();
      const list = await con
        .getRepository(BookmarkList)
        .save({ userId: loggedUser, name: 'Test' });
      await con
        .getRepository(Bookmark)
        .update({ userId: loggedUser, postId: 'p3' }, { listId: list.id });
      const res = await client.query(QUERY, { variables: { first: 2, now } });
      expect(res.data.bookmarksFeed.edges.length).toBeGreaterThan(0);
      const isOutsideFolder = res.data.bookmarksFeed.edges.every(
        ({ node }) => !node.bookmark.list,
      );
      expect(isOutsideFolder).toBeTruthy();
    });

    it('should return bookmarks by list id as plus user', async () => {
      await saveBookmarkFixtures();
      const list = await con
        .getRepository(BookmarkList)
        .save({ userId: loggedUser, name: 'Test' });
      await con
        .getRepository(Bookmark)
        .update({ userId: loggedUser, postId: 'p3' }, { listId: list.id });
      const res = await client.query(QUERY, {
        variables: { listId: list.id, now, first: 2 },
      });
      expect(res.data.bookmarksFeed.edges).toHaveLength(1);
      const isInsideFolder = res.data.bookmarksFeed.edges.every(
        ({ node }) => node.bookmark.list.id === list.id,
      );
      expect(isInsideFolder).toBeTruthy();
    });

    it('should return bookmarks by list id as plus user with two lists', async () => {
      await saveBookmarkFixtures();
      await con.getRepository(BookmarkList).save({
        userId: loggedUser,
        name: 'First',
        createdAt: subDays(new Date(), 1),
      });
      const second = await con
        .getRepository(BookmarkList)
        .save({ userId: loggedUser, name: 'Second' });
      await con
        .getRepository(Bookmark)
        .update({ userId: loggedUser, postId: 'p3' }, { listId: second.id });
      const res = await client.query(QUERY, {
        variables: { listId: second.id, now, first: 2 },
      });
      expect(res.data.bookmarksFeed.edges).toHaveLength(1);
      const isInsideFolder = res.data.bookmarksFeed.edges.every(
        ({ node }) => node.bookmark.list.id === second.id,
      );
      expect(isInsideFolder).toBeTruthy();
    });
  });

  describe('non-plus user', () => {
    it('should return bookmarks within the list', async () => {
      loggedUser = '1';
      await saveBookmarkFixtures();
      const list = await con
        .getRepository(BookmarkList)
        .save({ userId: loggedUser, name: 'Test' });
      await con
        .getRepository(Bookmark)
        .update({ userId: loggedUser, postId: 'p3' }, { listId: list.id });
      const res = await client.query(QUERY, {
        variables: { listId: list.id, now, first: 2 },
      });
      expect(res.data.bookmarksFeed.edges).toHaveLength(1);
      const isInsideFolder = res.data.bookmarksFeed.edges.every(
        ({ node }) => node.bookmark.list.id === list.id,
      );
      expect(isInsideFolder).toBeTruthy();
    });

    it('should not return bookmarks within the list if param is the second folder (unsubscribed)', async () => {
      loggedUser = '1';
      await saveBookmarkFixtures();
      const first = await con.getRepository(BookmarkList).save({
        userId: loggedUser,
        name: 'First',
        createdAt: subDays(new Date(), 1),
      });
      await con
        .getRepository(Bookmark)
        .update({ userId: loggedUser, postId: 'p1' }, { listId: first.id });
      const second = await con
        .getRepository(BookmarkList)
        .save({ userId: loggedUser, name: 'Second' });
      await con
        .getRepository(Bookmark)
        .update({ userId: loggedUser, postId: 'p3' }, { listId: second.id });
      const res = await client.query(QUERY, {
        variables: { listId: second.id, now, first: 2 },
      });
      expect(res.data.bookmarksFeed.edges).toHaveLength(0);
    });

    it('should return all bookmarks outside the first folder', async () => {
      loggedUser = '1';
      await saveBookmarkFixtures();
      const list = await con
        .getRepository(BookmarkList)
        .save({ userId: loggedUser, name: 'Test' });
      await con
        .getRepository(Bookmark)
        .update({ userId: loggedUser, postId: 'p3' }, { listId: list.id });
      const res = await client.query(QUERY, { variables: { now, first: 2 } }); // null list id param
      const isOutsideFolder = res.data.bookmarksFeed.edges.every(
        ({ node }) => node.bookmark.list?.id !== list.id,
      );
      expect(isOutsideFolder).toBeTruthy();
    });

    it('should return all bookmarks outside the first folder but includes every other folder', async () => {
      loggedUser = '1';
      await saveBookmarkFixtures();
      const first = await con.getRepository(BookmarkList).save({
        userId: loggedUser,
        name: 'First',
        createdAt: subDays(new Date(), 1),
      });
      const second = await con.getRepository(BookmarkList).save({
        userId: loggedUser,
        name: 'First',
      });
      await con
        .getRepository(Bookmark)
        .update({ userId: loggedUser, postId: 'p3' }, { listId: first.id });
      await con
        .getRepository(Bookmark)
        .update({ userId: loggedUser, postId: 'p1' }, { listId: second.id });
      const res = await client.query(QUERY, { variables: { now, first: 2 } }); // null list id param
      const isOutsideFirstFolder = res.data.bookmarksFeed.edges.every(
        ({ node }) => node.bookmark.list?.id !== first.id,
      );
      expect(isOutsideFirstFolder).toBeTruthy();
      const isInsideSecondFolder = res.data.bookmarksFeed.edges.some(
        ({ node }) => node.bookmark.list?.id === second.id,
      );
      expect(isInsideSecondFolder).toBeTruthy();
      const fromNoFolder = res.data.bookmarksFeed.edges.some(
        ({ node }) => !node.bookmark.list,
      );
      expect(fromNoFolder).toBeTruthy();
    });
  });

  it('should return unread bookmarks only', async () => {
    loggedUser = '1';
    await saveFixtures(con, Bookmark, bookmarksFixture);
    await con.getRepository(View).save([{ userId: '1', postId: 'p3' }]);
    const res = await client.query(QUERY, {
      variables: { first: 2, now, unreadOnly: true },
    });
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
    const res = await client.query(QUERY, {
      variables: { listId: list.id, now, first: 2 },
    });
    const withinFolder = res.data.bookmarksFeed.edges.every(
      ({ node }) => node.bookmark.list.id === list.id,
    );
    expect(withinFolder).toBeTruthy();
  });

  it('should include banned posts', async () => {
    loggedUser = '1';
    await saveFixtures(con, Bookmark, bookmarksFixture);
    await con.getRepository(Post).update({ id: 'p3' }, { banned: true });
    const res = await client.query(QUERY, { variables: { first: 2, now } });
    delete res.data.bookmarksFeed.pageInfo.endCursor;
    expect(res.data).toMatchSnapshot();
  });
});

describe('query bookmarksLists', () => {
  const QUERY = `{
    bookmarkLists {
      id, name, icon
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

  it('should return bookmark lists', async () => {
    loggedUser = '1';
    await con
      .getRepository(BookmarkList)
      .save({ userId: loggedUser, name: 'list', icon: '😀' });

    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    const folders = res.data.bookmarkLists;
    expect(folders).toHaveLength(1);
    expect(folders[0].name).toEqual('list');
    expect(folders[0].icon).toEqual('😀');
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

describe('mutation setBookmarkReminder', () => {
  const mutation = `
    mutation SetBookmarkReminder($postId: ID!, $remindAt: DateTime) {
      setBookmarkReminder(postId: $postId, remindAt: $remindAt) {
        _
      }
    }
  `;

  it('should throw UNAUTHENTICATED for anonymous users', async () =>
    testMutationErrorCode(
      client,
      { mutation, variables: { postId: 'p1' } },
      'UNAUTHENTICATED',
    ));

  it('should throw GRAPHQL_VALIDATION_ERROR if post id is missing', async () =>
    testMutationErrorCode(client, { mutation }, 'GRAPHQL_VALIDATION_FAILED'));

  it('should set remind at based on what the user sent', async () => {
    loggedUser = '1';
    const repo = con.getRepository(Bookmark);
    const bookmark = await repo.save({ postId: 'p1', userId: loggedUser });
    expect(bookmark.remindAt).toBeNull();
    const date = new Date().toISOString();
    const res = await client.mutate(mutation, {
      variables: { postId: 'p1', remindAt: date },
    });
    expect(res.errors).toBeFalsy();

    const result = await repo.findOneBy({ postId: 'p1', userId: loggedUser });
    expect(result.remindAt.toISOString()).toEqual(date);
  });

  it('should remove the reading reminder when null is sent', async () => {
    loggedUser = '1';
    const repo = con.getRepository(Bookmark);
    const date = new Date();
    const bookmark = await repo.save({
      postId: 'p1',
      userId: loggedUser,
      remindAt: date,
    });
    expect(bookmark.remindAt).toEqual(date);
    const res = await client.mutate(mutation, {
      variables: { postId: 'p1', remindAt: null },
    });
    expect(res.errors).toBeFalsy();

    const result = await repo.findOneBy({ postId: 'p1', userId: loggedUser });
    expect(result.remindAt).toBeNull();
  });
});
