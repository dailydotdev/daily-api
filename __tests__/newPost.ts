import { Connection, getConnection } from 'typeorm';
import { FastifyInstance } from 'fastify';
import { SearchIndex } from 'algoliasearch';
import { mocked } from 'ts-jest/utils';
import Mock = jest.Mock;

import appFunc from '../src';
import worker from '../src/workers/newPost';
import { mockMessage, saveFixtures } from './helpers';
import { Post, PostTag, Source } from '../src/entity';
import { sourcesFixture } from './fixture/source';
import { getPostsIndex } from '../src/common';
import { postsFixture } from './fixture/post';

let con: Connection;
let app: FastifyInstance;
let saveObjectMock: Mock;

jest.mock('../src/common/algolia', () => ({
  ...jest.requireActual('../src/common/algolia'),
  getPostsIndex: jest.fn(),
}));

beforeAll(async () => {
  con = await getConnection();
  app = await appFunc();
  return app.ready();
});

beforeEach(async () => {
  saveObjectMock = jest.fn();
  mocked(getPostsIndex).mockReturnValue(({
    saveObject: saveObjectMock,
  } as unknown) as SearchIndex);

  await saveFixtures(con, Source, sourcesFixture);
});

it('should save a new post with basic information', async () => {
  const message = mockMessage({
    id: 'p1',
    title: 'Title',
    url: 'https://post.com',
    publicationId: 'a',
  });

  await worker.handler(message, con, app.log);
  expect(message.ack).toBeCalledTimes(1);
  expect(saveObjectMock).toBeCalledWith({
    objectID: 'p1',
    title: 'Title',
    createdAt: expect.any(Number),
    views: 0,
    readTime: undefined,
    pubId: 'a',
    _tags: undefined,
  });
  const posts = await con.getRepository(Post).find();
  const tags = await con.getRepository(PostTag).find();
  expect(posts.length).toEqual(1);
  expect(tags.length).toEqual(0);
  expect(posts[0]).toMatchSnapshot({
    createdAt: expect.any(Date),
    score: expect.any(Number),
  });
});

it('should save a new post with full information', async () => {
  const timestamp = new Date(2020, 5, 11, 1, 17);
  const message = mockMessage({
    id: 'p1',
    title: 'Title',
    url: 'https://post.com',
    publicationId: 'a',
    publishedAt: timestamp.toISOString(),
    image: 'https://image.com',
    ratio: 2,
    placeholder: 'data:image/jpeg;base64,placeholder',
    tags: ['webdev', 'javascript', 'html'],
    siteTwitter: 'site',
    creatorTwitter: 'creator',
    readTime: '5.123',
  });

  await worker.handler(message, con, app.log);
  expect(message.ack).toBeCalledTimes(1);
  expect(saveObjectMock).toBeCalledWith({
    objectID: 'p1',
    title: 'Title',
    createdAt: expect.any(Number),
    views: 0,
    readTime: 5,
    pubId: 'a',
    _tags: ['webdev', 'javascript', 'html'],
  });
  const posts = await con.getRepository(Post).find();
  const tags = await con.getRepository(PostTag).find();
  expect(posts.length).toEqual(1);
  expect(posts[0]).toMatchSnapshot({
    createdAt: expect.any(Date),
    score: expect.any(Number),
  });
  expect(tags).toMatchSnapshot();
});

it('should handle empty tags array', async () => {
  const message = mockMessage({
    id: 'p1',
    title: 'Title',
    url: 'https://post.com',
    publicationId: 'a',
    tags: [],
  });

  await worker.handler(message, con, app.log);
  expect(message.ack).toBeCalledTimes(1);
  expect(saveObjectMock).toBeCalledWith({
    objectID: 'p1',
    title: 'Title',
    createdAt: expect.any(Number),
    views: 0,
    readTime: undefined,
    pubId: 'a',
    _tags: [],
  });
  const posts = await con.getRepository(Post).find();
  const tags = await con.getRepository(PostTag).find();
  expect(posts.length).toEqual(1);
  expect(tags.length).toEqual(0);
});

it('should ignore duplicate post', async () => {
  await saveFixtures(con, Post, [postsFixture[0]]);

  const message = mockMessage({
    id: 'p1',
    title: 'Title',
    url: 'https://post.com',
    publicationId: 'a',
  });

  await worker.handler(message, con, app.log);
  expect(message.ack).toBeCalledTimes(1);
  expect(saveObjectMock).toBeCalledTimes(0);
  const posts = await con.getRepository(Post).find();
  expect(posts.length).toEqual(1);
  expect(posts[0]).toMatchSnapshot({
    createdAt: expect.any(Date),
  });
});
