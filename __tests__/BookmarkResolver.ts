import { FastifyInstance } from 'fastify';
import { Connection, getConnection } from 'typeorm';
import { ApolloServer } from 'apollo-server-fastify';
import {
  ApolloServerTestClient,
  createTestClient,
} from 'apollo-server-testing';
import createApolloServer from '../src/apollo';
import { Context } from '../src/Context';
import {
  authorizeRequest,
  MockContext,
  testMutationErrorCode,
} from './helpers';
import appFunc from '../src';
import { Bookmark, Post } from '../src/entity';
import * as request from 'supertest';

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

  const repo = con.getRepository(Post);
  await repo.save(
    Array.from(new Array(3), (_, i) =>
      repo.create({
        id: i.toString(),
        timeDecay: 0,
        score: 0,
      }),
    ),
  );
});

afterAll(() => app.close());

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
      'UNAUTHORIZED_ERROR',
    ));

  it('should add new bookmarks', async () => {
    loggedUser = '1';
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { data: { postIds: ['0', '2'] } },
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
    await repo.save(repo.create({ postId: '2', userId: loggedUser }));
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { data: { postIds: ['0', '2'] } },
    });
    expect(res.errors).toBeFalsy();
    const actual = await repo.find({
      where: { userId: loggedUser },
      select: ['postId', 'userId'],
    });
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
      'UNAUTHORIZED_ERROR',
    ));

  it('should remove existing bookmark', async () => {
    loggedUser = '1';
    const repo = con.getRepository(Bookmark);
    await repo.save(repo.create({ postId: '2', userId: loggedUser }));
    const res = await client.mutate({
      mutation: MUTATION('2'),
    });
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
    const res = await client.mutate({
      mutation: MUTATION('2'),
    });
    expect(res.errors).toBeFalsy();
    const actual = await repo.find({
      where: { userId: loggedUser },
      select: ['postId', 'userId'],
    });
    expect(actual.length).toEqual(0);
  });
});

describe('compatibility routes', () => {
  describe('POST /posts/bookmarks', () => {
    it('should return bad request when no body is provided', () =>
      authorizeRequest(request(app.server).post('/v1/posts/bookmarks')).expect(
        400,
      ));

    it('should add new bookmarks', async () => {
      await authorizeRequest(request(app.server).post('/v1/posts/bookmarks'))
        .send(['0', '2'])
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
      await repo.save(repo.create({ postId: '2', userId: '1' }));
      await authorizeRequest(request(app.server).delete('/v1/posts/2/bookmark'))
        .send()
        .expect(204);
      const actual = await repo.find({
        where: { userId: '1' },
        select: ['postId', 'userId'],
      });
      expect(actual.length).toEqual(0);
    });
  });
});
