import { Connection, getConnection } from 'typeorm';
import { FastifyInstance } from 'fastify';
import { SearchIndex } from 'algoliasearch';
import { mocked } from 'ts-jest/utils';
import Mock = jest.Mock;

import appFunc from '../../src/background';
import worker from '../../src/workers/newPost';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import {
  Keyword,
  Post,
  PostKeyword,
  PostTag,
  Source,
  TagCount,
  User,
} from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { getPostsIndex, notifyPostAuthorMatched } from '../../src/common';

let con: Connection;
let app: FastifyInstance;
let saveObjectMock: Mock;

jest.mock('../../src/common/algolia', () => ({
  ...jest.requireActual('../../src/common/algolia'),
  getPostsIndex: jest.fn(),
}));

jest.mock('../../src/common', () => ({
  ...jest.requireActual('../../src/common'),
  notifyPostAuthorMatched: jest.fn(),
}));

beforeAll(async () => {
  con = await getConnection();
  app = await appFunc();
  return app.ready();
});

beforeEach(async () => {
  jest.resetAllMocks();
  saveObjectMock = jest.fn();
  mocked(getPostsIndex).mockReturnValue(({
    saveObject: saveObjectMock,
  } as unknown) as SearchIndex);

  await saveFixtures(con, Source, sourcesFixture);
});

it('should save a new post with basic information', async () => {
  await expectSuccessfulBackground(app, worker, {
    id: 'p1',
    title: 'Title',
    url: 'https://post.com',
    publicationId: 'a',
  });
  const posts = await con.getRepository(Post).find();
  expect(posts.length).toEqual(1);
  expect(saveObjectMock).toBeCalledWith({
    objectID: posts[0].id,
    title: 'Title',
    createdAt: expect.any(Number),
    views: 0,
    readTime: undefined,
    pubId: 'a',
    _tags: undefined,
  });
  const tags = await con.getRepository(PostTag).find();
  expect(tags.length).toEqual(0);
  expect(posts[0]).toMatchSnapshot({
    createdAt: expect.any(Date),
    score: expect.any(Number),
    id: expect.any(String),
    shortId: expect.any(String),
  });
});

it('should save a new post with full information', async () => {
  const timestamp = new Date(2020, 5, 11, 1, 17);

  await con.getRepository(TagCount).save([
    { tag: 'javascript', count: 20 },
    { tag: 'html', count: 15 },
    { tag: 'webdev', count: 5 },
  ]);
  await expectSuccessfulBackground(app, worker, {
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
  expect(saveObjectMock).toBeCalledWith({
    objectID: expect.any(String),
    title: 'Title',
    createdAt: expect.any(Number),
    views: 0,
    readTime: 5,
    pubId: 'a',
    _tags: ['webdev', 'javascript', 'html'],
  });
  const posts = await con.getRepository(Post).find();
  const tags = await con.getRepository(PostTag).find({ select: ['tag'] });
  expect(posts.length).toEqual(1);
  expect(posts[0]).toMatchSnapshot({
    createdAt: expect.any(Date),
    score: expect.any(Number),
    id: expect.any(String),
    shortId: expect.any(String),
  });
  expect(tags).toMatchSnapshot();
});

it('should handle empty tags array', async () => {
  await expectSuccessfulBackground(app, worker, {
    id: 'p1',
    title: 'Title',
    url: 'https://post.com',
    publicationId: 'a',
    tags: [],
  });
  expect(saveObjectMock).toBeCalledWith({
    objectID: expect.any(String),
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

it('should save keywords', async () => {
  await expectSuccessfulBackground(app, worker, {
    id: 'p1',
    title: 'Title',
    url: 'https://post.com',
    publicationId: 'a',
    keywords: ['vue', 'nodejs'],
  });
  expect(saveObjectMock).toBeCalledTimes(1);
  const posts = await con.getRepository(Post).find();
  const postKeywords = await con
    .getRepository(PostKeyword)
    .find({ select: ['keyword'], order: { keyword: 'ASC' } });
  const keywords = await con
    .getRepository(Keyword)
    .find({ select: ['value', 'status'], order: { value: 'ASC' } });
  expect(posts.length).toEqual(1);
  expect(postKeywords).toMatchSnapshot();
  expect(keywords).toMatchSnapshot();
});

it('should increase occurrences by one when keyword exists', async () => {
  await con.getRepository(Keyword).save([{ value: 'nodejs', status: 'allow' }]);
  await expectSuccessfulBackground(app, worker, {
    id: 'p1',
    title: 'Title',
    url: 'https://post.com',
    publicationId: 'a',
    keywords: ['vue', 'nodejs'],
  });
  expect(saveObjectMock).toBeCalledTimes(1);
  const posts = await con.getRepository(Post).find();
  const postKeywords = await con
    .getRepository(PostKeyword)
    .find({ select: ['keyword'], order: { keyword: 'ASC' } });
  const keywords = await con.getRepository(Keyword).find({
    select: ['value', 'status', 'occurrences'],
    order: { value: 'ASC' },
  });
  expect(posts.length).toEqual(1);
  expect(postKeywords).toMatchSnapshot();
  expect(keywords).toMatchSnapshot();
});

it('should replace synonym keywords', async () => {
  await con.getRepository(Keyword).save([
    { value: 'node', status: 'synonym', synonym: 'nodejs' },
    { value: 'nodejs', status: 'allow' },
  ]);
  await expectSuccessfulBackground(app, worker, {
    id: 'p1',
    title: 'Title',
    url: 'https://post.com',
    publicationId: 'a',
    keywords: ['vue', 'node'],
  });
  expect(saveObjectMock).toBeCalledTimes(1);
  const posts = await con.getRepository(Post).find();
  const postKeywords = await con
    .getRepository(PostKeyword)
    .find({ select: ['keyword'], order: { keyword: 'ASC' } });
  const keywords = await con
    .getRepository(Keyword)
    .find({ select: ['value', 'status'], order: { value: 'ASC' } });
  expect(posts.length).toEqual(1);
  expect(postKeywords).toMatchSnapshot();
  expect(keywords).toMatchSnapshot();
});

it('should handle empty keywords array', async () => {
  await expectSuccessfulBackground(app, worker, {
    id: 'p1',
    title: 'Title',
    url: 'https://post.com',
    publicationId: 'a',
    keywords: [],
  });
  expect(saveObjectMock).toBeCalledTimes(1);
  const posts = await con.getRepository(Post).find();
  const postKeywords = await con.getRepository(PostKeyword).find();
  const keywords = await con.getRepository(Keyword).find();
  expect(posts.length).toEqual(1);
  expect(postKeywords.length).toEqual(0);
  expect(keywords.length).toEqual(0);
});

it('should ignore null value violation', async () => {
  await expectSuccessfulBackground(app, worker, {
    id: 'p1',
    title: 'Title',
    url: null,
    publicationId: 'a',
  });
  expect(saveObjectMock).toBeCalledTimes(0);
  const posts = await con.getRepository(Post).find();
  expect(posts.length).toEqual(0);
});

it('should not save post with existing url', async () => {
  await con.getRepository(Post).save({
    id: 'p2',
    shortId: 'p2',
    title: 'Title 2',
    url: 'https://post.com',
    sourceId: 'b',
  });

  await expectSuccessfulBackground(app, worker, {
    id: 'p1',
    title: 'Title',
    url: 'https://post.com',
    publicationId: 'a',
  });
  expect(saveObjectMock).toBeCalledTimes(0);
  const posts = await con.getRepository(Post).find();
  expect(posts.length).toEqual(1);
});

it('should not save post when url matches existing canonical url', async () => {
  await con.getRepository(Post).save({
    id: 'p2',
    shortId: 'p2',
    title: 'Title 2',
    url: 'https://post.com',
    canonicalUrl: 'https://post.dev',
    sourceId: 'b',
  });

  await expectSuccessfulBackground(app, worker, {
    id: 'p1',
    title: 'Title',
    url: 'https://post.dev',
    publicationId: 'a',
  });
  expect(saveObjectMock).toBeCalledTimes(0);
  const posts = await con.getRepository(Post).find();
  expect(posts.length).toEqual(1);
});

it('should not save post when canonical url matches existing url', async () => {
  await con.getRepository(Post).save({
    id: 'p2',
    shortId: 'p2',
    title: 'Title 2',
    url: 'https://post.com',
    canonicalUrl: 'https://post.dev',
    sourceId: 'b',
  });

  await expectSuccessfulBackground(app, worker, {
    id: 'p1',
    title: 'Title',
    url: 'https://post.io',
    canonicalUrl: 'https://post.com',
    publicationId: 'a',
  });
  expect(saveObjectMock).toBeCalledTimes(0);
  const posts = await con.getRepository(Post).find();
  expect(posts.length).toEqual(1);
});

it('should not save post when canonical url matches existing canonical url', async () => {
  await con.getRepository(Post).save({
    id: 'p2',
    shortId: 'p2',
    title: 'Title 2',
    url: 'https://post.com',
    canonicalUrl: 'https://post.dev',
    sourceId: 'b',
  });

  await expectSuccessfulBackground(app, worker, {
    id: 'p1',
    title: 'Title',
    url: 'https://post.io',
    canonicalUrl: 'https://post.dev',
    publicationId: 'a',
  });
  expect(saveObjectMock).toBeCalledTimes(0);
  const posts = await con.getRepository(Post).find();
  expect(posts.length).toEqual(1);
});

it('should match post to author', async () => {
  await con.getRepository(User).save([
    {
      id: '1',
      name: 'Ido',
      image: 'https://daily.dev/ido.jpg',
      twitter: 'idoshamun',
    },
  ]);

  await expectSuccessfulBackground(app, worker, {
    id: 'p1',
    title: 'Title',
    url: 'https://post.com',
    publicationId: 'a',
    creatorTwitter: '@idoshamun',
  });
  const posts = await con.getRepository(Post).find();
  expect(posts.length).toEqual(1);
  expect(saveObjectMock).toBeCalledWith({
    objectID: posts[0].id,
    title: 'Title',
    createdAt: expect.any(Number),
    views: 0,
    readTime: undefined,
    pubId: 'a',
    _tags: undefined,
  });
  expect(posts[0]).toMatchSnapshot({
    createdAt: expect.any(Date),
    score: expect.any(Number),
    id: expect.any(String),
    shortId: expect.any(String),
  });
  expect(mocked(notifyPostAuthorMatched).mock.calls[0].slice(1)).toEqual([
    posts[0].id,
    '1',
  ]);
});

it('should match post to author based on username', async () => {
  await con.getRepository(User).save([
    {
      id: '1',
      name: 'Ido',
      image: 'https://daily.dev/ido.jpg',
      username: 'idoshamun',
    },
  ]);
  await expectSuccessfulBackground(app, worker, {
    id: 'p1',
    title: 'Title',
    url: 'https://post.com',
    publicationId: 'a',
    creatorTwitter: '@idoshamun',
  });
  const posts = await con.getRepository(Post).find();
  expect(posts.length).toEqual(1);
  expect(saveObjectMock).toBeCalledWith({
    objectID: posts[0].id,
    title: 'Title',
    createdAt: expect.any(Number),
    views: 0,
    readTime: undefined,
    pubId: 'a',
    _tags: undefined,
  });
  expect(posts[0]).toMatchSnapshot({
    createdAt: expect.any(Date),
    score: expect.any(Number),
    id: expect.any(String),
    shortId: expect.any(String),
  });
  expect(mocked(notifyPostAuthorMatched).mock.calls[0].slice(1)).toEqual([
    posts[0].id,
    '1',
  ]);
});

it('should not match post to author', async () => {
  await expectSuccessfulBackground(app, worker, {
    id: 'p1',
    title: 'Title',
    url: 'https://post.com',
    publicationId: 'a',
    creatorTwitter: '@nouser',
  });
  const posts = await con.getRepository(Post).find();
  expect(posts.length).toEqual(1);
  expect(saveObjectMock).toBeCalledWith({
    objectID: posts[0].id,
    title: 'Title',
    createdAt: expect.any(Number),
    views: 0,
    readTime: undefined,
    pubId: 'a',
    _tags: undefined,
  });
  expect(posts[0]).toMatchSnapshot({
    createdAt: expect.any(Date),
    score: expect.any(Number),
    id: expect.any(String),
    shortId: expect.any(String),
  });
  expect(notifyPostAuthorMatched).toBeCalledTimes(0);
});

it('should clear empty creator twitter', async () => {
  await expectSuccessfulBackground(app, worker, {
    id: 'p1',
    title: 'Title',
    url: 'https://post.com',
    publicationId: 'a',
    creatorTwitter: '',
  });
  expect(saveObjectMock).toBeCalledTimes(1);
  const posts = await con.getRepository(Post).find();
  expect(posts.length).toEqual(1);
  expect(posts[0].creatorTwitter).toBeNull();
});

it('should clear invalid creator twitter', async () => {
  await expectSuccessfulBackground(app, worker, {
    id: 'p1',
    title: 'Title',
    url: 'https://post.com',
    publicationId: 'a',
    creatorTwitter: '@',
  });
  expect(saveObjectMock).toBeCalledTimes(1);
  const posts = await con.getRepository(Post).find();
  expect(posts.length).toEqual(1);
  expect(posts[0].creatorTwitter).toBeNull();
});

it('should not save post when author is banned', async () => {
  await expectSuccessfulBackground(app, worker, {
    id: 'p1',
    title: 'Title',
    url: 'https://post.io',
    publicationId: 'a',
    creatorTwitter: '@NewGenDeveloper',
  });
  expect(saveObjectMock).toBeCalledTimes(0);
  const posts = await con.getRepository(Post).find();
  expect(posts.length).toEqual(0);
});
