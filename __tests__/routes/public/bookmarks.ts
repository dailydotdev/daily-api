import request from 'supertest';
import { setupPublicApiTests, createTokenForUser } from './helpers';
import { Bookmark, BookmarkList } from '../../../src/entity';
import { v4 as uuidv4 } from 'uuid';

const state = setupPublicApiTests();

const listId1 = uuidv4();
const listId2 = uuidv4();
const listToDeleteId = uuidv4();

const bookmarksFixture = [
  { userId: '5', postId: 'p1', createdAt: new Date() },
  {
    userId: '5',
    postId: 'p2',
    createdAt: new Date(Date.now() - 1000),
  },
  {
    userId: '5',
    postId: 'p3',
    createdAt: new Date(Date.now() - 2000),
  },
];

describe('GET /public/v1/bookmarks', () => {
  beforeEach(async () => {
    await state.con.getRepository(Bookmark).save(bookmarksFixture);
  });

  it('should return user bookmarks', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/bookmarks')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(3);
    expect(body.pagination).toMatchObject({
      hasNextPage: expect.any(Boolean),
    });
  });

  it('should support limit parameter', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/bookmarks')
      .query({ limit: 2 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data.length).toBeLessThanOrEqual(2);
  });

  it('should include post metadata in response', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/bookmarks')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data[0]).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      source: expect.any(Object),
    });
  });
});

// Note: searchBookmarks endpoint depends on external search services
// These tests are skipped as they require mocking the search infrastructure
describe.skip('GET /public/v1/bookmarks/search', () => {
  beforeEach(async () => {
    await state.con.getRepository(Bookmark).save(bookmarksFixture);
  });

  it('should search within bookmarks', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/bookmarks/search')
      .query({ q: 'P1' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
  });
});

describe('GET /public/v1/bookmarks/lists', () => {
  beforeEach(async () => {
    await state.con.getRepository(BookmarkList).save([
      { id: listId1, userId: '5', name: 'My List', icon: '📚' },
      { id: listId2, userId: '5', name: 'Another List' },
    ]);
  });

  it('should return user bookmark lists', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/bookmarks/lists')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(2);
    expect(body.data[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
    });
  });
});

describe('POST /public/v1/bookmarks/lists', () => {
  it('should create a new bookmark list', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .post('/public/v1/bookmarks/lists')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New List', icon: '🚀' }) // Must use valid emoji from VALID_FOLDER_EMOJIS
      .expect(200);

    expect(body.data).toMatchObject({
      id: expect.any(String),
      name: 'New List',
      icon: '🚀',
    });

    // Verify it was created in the database
    const list = await state.con
      .getRepository(BookmarkList)
      .findOneBy({ name: 'New List' });
    expect(list).toBeTruthy();
  });
});

describe('DELETE /public/v1/bookmarks/lists/:id', () => {
  beforeEach(async () => {
    await state.con.getRepository(BookmarkList).save({
      id: listToDeleteId,
      userId: '5',
      name: 'Delete Me',
    });
  });

  it('should delete a bookmark list', async () => {
    const token = await createTokenForUser(state.con, '5');

    await request(state.app.server)
      .delete(`/public/v1/bookmarks/lists/${listToDeleteId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    // Verify it was deleted
    const list = await state.con
      .getRepository(BookmarkList)
      .findOneBy({ id: listToDeleteId });
    expect(list).toBeNull();
  });
});

describe('POST /public/v1/bookmarks', () => {
  it('should add bookmarks', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .post('/public/v1/bookmarks')
      .set('Authorization', `Bearer ${token}`)
      .send({ postIds: ['p1', 'p2'] })
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(2);
    expect(body.data[0]).toMatchObject({
      postId: expect.any(String),
      createdAt: expect.any(String),
    });

    // Verify bookmarks were created
    const bookmarks = await state.con
      .getRepository(Bookmark)
      .find({ where: { userId: '5' } });
    expect(bookmarks.length).toBe(2);
  });

  it('should ignore non-existent post IDs', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .post('/public/v1/bookmarks')
      .set('Authorization', `Bearer ${token}`)
      .send({ postIds: ['p1', 'non-existent'] })
      .expect(200);

    // Should only bookmark the existing post
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(1);
    expect(body.data[0].postId).toBe('p1');
  });
});

describe('DELETE /public/v1/bookmarks/:id', () => {
  beforeEach(async () => {
    await state.con.getRepository(Bookmark).save({
      userId: '5',
      postId: 'p1',
    });
  });

  it('should remove a bookmark', async () => {
    const token = await createTokenForUser(state.con, '5');

    await request(state.app.server)
      .delete('/public/v1/bookmarks/p1')
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    // Verify it was deleted
    const bookmark = await state.con
      .getRepository(Bookmark)
      .findOneBy({ userId: '5', postId: 'p1' });
    expect(bookmark).toBeNull();
  });
});

describe('POST /public/v1/bookmarks with listId', () => {
  const listIdForCreate = uuidv4();

  beforeEach(async () => {
    await state.con.getRepository(BookmarkList).save({
      id: listIdForCreate,
      userId: '5',
      name: 'Test List',
    });
  });

  it('should add bookmark to specific list when listId is provided', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .post('/public/v1/bookmarks')
      .set('Authorization', `Bearer ${token}`)
      .send({ postIds: ['p1'], listId: listIdForCreate })
      .expect(200);

    expect(body.data).toHaveLength(1);
    expect(body.data[0].postId).toBe('p1');
    expect(body.data[0].listId).toBe(listIdForCreate);

    // Verify in database
    const bookmark = await state.con
      .getRepository(Bookmark)
      .findOneBy({ userId: '5', postId: 'p1' });
    expect(bookmark?.listId).toBe(listIdForCreate);
  });

  it('should return listId in response', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .post('/public/v1/bookmarks')
      .set('Authorization', `Bearer ${token}`)
      .send({ postIds: ['p1'], listId: listIdForCreate })
      .expect(200);

    expect(body.data[0]).toMatchObject({
      postId: 'p1',
      createdAt: expect.any(String),
      listId: listIdForCreate,
    });
  });
});

describe('PATCH /public/v1/bookmarks/:id', () => {
  const listIdForMove = uuidv4();

  beforeEach(async () => {
    await state.con.getRepository(BookmarkList).save({
      id: listIdForMove,
      userId: '5',
      name: 'Move Target List',
    });
    await state.con.getRepository(Bookmark).save({
      userId: '5',
      postId: 'p1',
    });
  });

  it('should move bookmark to a list', async () => {
    const token = await createTokenForUser(state.con, '5');

    await request(state.app.server)
      .patch('/public/v1/bookmarks/p1')
      .set('Authorization', `Bearer ${token}`)
      .send({ listId: listIdForMove })
      .expect(204);

    // Verify the bookmark was moved
    const bookmark = await state.con
      .getRepository(Bookmark)
      .findOneBy({ userId: '5', postId: 'p1' });
    expect(bookmark?.listId).toBe(listIdForMove);
  });

  it('should move bookmark out of a list when listId is null', async () => {
    const token = await createTokenForUser(state.con, '5');

    // First move to a list
    await state.con
      .getRepository(Bookmark)
      .update({ userId: '5', postId: 'p1' }, { listId: listIdForMove });

    // Then move out of list
    await request(state.app.server)
      .patch('/public/v1/bookmarks/p1')
      .set('Authorization', `Bearer ${token}`)
      .send({ listId: null })
      .expect(204);

    // Verify the bookmark was moved out
    const bookmark = await state.con
      .getRepository(Bookmark)
      .findOneBy({ userId: '5', postId: 'p1' });
    expect(bookmark?.listId).toBeNull();
  });

  it('should move bookmark out of a list when listId is omitted', async () => {
    const token = await createTokenForUser(state.con, '5');

    // First move to a list
    await state.con
      .getRepository(Bookmark)
      .update({ userId: '5', postId: 'p1' }, { listId: listIdForMove });

    // Then move out of list by omitting listId
    await request(state.app.server)
      .patch('/public/v1/bookmarks/p1')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(204);

    // Verify the bookmark was moved out
    const bookmark = await state.con
      .getRepository(Bookmark)
      .findOneBy({ userId: '5', postId: 'p1' });
    expect(bookmark?.listId).toBeNull();
  });
});
