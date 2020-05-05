import { FastifyInstance } from 'fastify';
import { Connection, getConnection } from 'typeorm';
import { ApolloServer } from 'apollo-server-fastify';
import {
  ApolloServerTestClient,
  createTestClient,
} from 'apollo-server-testing';
import * as request from 'supertest';
import * as _ from 'lodash';

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
  HiddenPost,
  Post,
  PostTag,
  Source,
  SourceDisplay,
} from '../src/entity';
import { sourcesFixture } from './fixture/source';
import { sourceDisplaysFixture } from './fixture/sourceDisplay';
import { postsFixture, postTagsFixture } from './fixture/post';
import { notifyPostReport } from '../src/common';

let app: FastifyInstance;
let con: Connection;
let server: ApolloServer;
let client: ApolloServerTestClient;
let loggedUser: string = null;

jest.mock('../src/common', () => ({
  ...jest.requireActual('../src/common'),
  notifyPostReport: jest.fn(),
}));

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
  await saveFixtures(con, SourceDisplay, sourceDisplaysFixture);
  await saveFixtures(con, Post, postsFixture);
  await saveFixtures(con, PostTag, postTagsFixture);
});

afterAll(() => app.close());

describe('query post', () => {
  const QUERY = (id: string): string => `{
    post(id: "${id}") {
      id
      url
      title
      image
      ratio
      placeholder
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

  it('should throw not found when cannot find post', () =>
    testQueryErrorCode(
      client,
      { query: QUERY('notfound') },
      'NOT_FOUND_ERROR',
    ));

  it('should return post by id', async () => {
    const res = await client.query({ query: QUERY('p1') });
    expect(res.data).toMatchSnapshot();
  });
});

describe('mutation hidePost', () => {
  const MUTATION = `
  mutation HidePost($id: ID!) {
  hidePost(id: $id) {
    _
  }
}`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'p1' },
      },
      'UNAUTHORIZED_ERROR',
    ));

  it('should throw not found when cannot find post', () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'invalid' },
      },
      'NOT_FOUND_ERROR',
    );
  });

  it('should hide the post', async () => {
    loggedUser = '1';
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { id: 'p1' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con
      .getRepository(HiddenPost)
      .find({ where: { userId: loggedUser }, select: ['postId', 'userId'] });
    expect(actual).toMatchSnapshot();
  });

  it('should ignore conflicts', async () => {
    loggedUser = '1';
    const repo = con.getRepository(HiddenPost);
    await repo.save(repo.create({ postId: 'p1', userId: loggedUser }));
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { id: 'p1' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await repo.find({
      where: { userId: loggedUser },
      select: ['postId', 'userId'],
    });
    expect(actual).toMatchSnapshot();
  });
});

describe('mutation reportPost', () => {
  const MUTATION = `
  mutation ReportPost($id: ID!, $reason: ReportReason) {
  reportPost(id: $id, reason: $reason) {
    _
  }
}`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'p1', reason: 'BROKEN' },
      },
      'UNAUTHORIZED_ERROR',
    ));

  it('should throw not found when cannot find post', () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'invalid', reason: 'BROKEN' },
      },
      'NOT_FOUND_ERROR',
    );
  });

  it('should report post', async () => {
    loggedUser = '1';
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { id: 'p1', reason: 'BROKEN' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con
      .getRepository(HiddenPost)
      .find({ where: { userId: loggedUser }, select: ['postId', 'userId'] });
    expect(actual).toMatchSnapshot();
    const post = await con.getRepository(Post).findOne('p1');
    expect(notifyPostReport).toBeCalledWith(loggedUser, post, 'Link is broken');
  });

  it('should ignore conflicts', async () => {
    loggedUser = '1';
    const repo = con.getRepository(HiddenPost);
    await repo.save(repo.create({ postId: 'p1', userId: loggedUser }));
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { id: 'p1', reason: 'BROKEN' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await repo.find({
      where: { userId: loggedUser },
      select: ['postId', 'userId'],
    });
    expect(actual).toMatchSnapshot();
    expect(notifyPostReport).toBeCalledTimes(0);
  });
});

describe('compatibility routes', () => {
  describe('GET /posts/:id', () => {
    it('should throw not found when cannot find post', () =>
      request(app.server).get('/v1/posts/invalid').send().expect(404));

    it('should return post by id', async () => {
      const res = await request(app.server)
        .get('/v1/posts/p1')
        .send()
        .expect(200);
      expect(_.omit(res.body, ['createdAt'])).toMatchSnapshot();
    });
  });

  describe('POST /posts/:id/hide', () => {
    it('should hide the post', async () => {
      await authorizeRequest(request(app.server).post('/v1/posts/p1/hide'))
        .send()
        .expect(204);
      const actual = await con
        .getRepository(HiddenPost)
        .find({ where: { userId: '1' }, select: ['postId', 'userId'] });
      expect(actual).toMatchSnapshot();
    });
  });

  describe('POST /posts/:id/report', () => {
    it('should return bad request when no body is provided', () =>
      authorizeRequest(request(app.server).post('/v1/posts/p1/report')).expect(
        400,
      ));

    it('should report the post', async () => {
      await authorizeRequest(request(app.server).post('/v1/posts/p1/report'))
        .send({ reason: 'broken' })
        .expect(204);
      const actual = await con
        .getRepository(HiddenPost)
        .find({ where: { userId: '1' }, select: ['postId', 'userId'] });
      expect(actual).toMatchSnapshot();
      const post = await con.getRepository(Post).findOne('p1');
      expect(notifyPostReport).toBeCalledWith('1', post, 'Link is broken');
    });
  });
});
