import { Connection, getConnection } from 'typeorm';
import nock from 'nock';
import { deleteKeysByPattern, redisClient } from '../src/redis';
import {
  generatePersonalizedFeed,
  getPersonalizedFeedKey,
  getPersonalizedFeedKeyPrefix,
} from '../src/personalizedFeed';
import { Feed, FeedSource, FeedTag, Source } from '../src/entity';
import { saveFixtures } from './helpers';
import { sourcesFixture } from './fixture/source';

let con: Connection;

const tinybirdResponse = {
  data: [
    { post_id: '1' },
    { post_id: '2' },
    { post_id: '3' },
    { post_id: '4' },
    { post_id: '5' },
    { post_id: '6' },
  ],
};

const mockFeatures = (data = {}) => {
  nock(process.env.GATEWAY_URL)
    .get('/boot/features')
    .matchHeader('authorization', `Service ${process.env.GATEWAY_SECRET}`)
    .matchHeader('user-id', 'u1')
    .reply(200, data);
};
beforeAll(async () => {
  con = await getConnection();
});

beforeEach(async () => {
  jest.clearAllMocks();
  nock.cleanAll();
  await deleteKeysByPattern('feeds:*');
  await saveFixtures(con, Source, sourcesFixture);
});

it('should fetch anonymous feed and serve consequent pages from cache', async () => {
  nock('http://localhost:6000')
    .get('/feed.json?token=token&page_size=2&fresh_page_size=1&feed_version=5')
    .reply(200, tinybirdResponse);
  const page0 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
  });
  expect(page0).toEqual(['1', '2']);
  expect(nock.isDone()).toEqual(true);
  await new Promise((resolve) => setTimeout(resolve, 50));
  const page1 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 2,
    feedVersion: 5,
  });
  expect(page1).toEqual(['3', '4']);
});

it('should fetch anonymous feed and serve consequent calls from cache', async () => {
  nock('http://localhost:6000')
    .get('/feed.json?token=token&page_size=2&fresh_page_size=1&feed_version=5')
    .reply(200, tinybirdResponse);
  const page0 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
  });
  expect(page0).toEqual(['1', '2']);
  expect(nock.isDone()).toEqual(true);
  await new Promise((resolve) => setTimeout(resolve, 50));
  const page1 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
  });
  expect(page1).toEqual(['1', '2']);
});

it('should fetch anonymous feed even when cache is old', async () => {
  const key = getPersonalizedFeedKey();
  const pipeline = redisClient.pipeline();
  pipeline.set(
    `${key}:time`,
    new Date(new Date().getTime() - 60 * 60 * 1000).toISOString(),
  );
  ['7', '8'].forEach((id, i) => pipeline.zadd(key, i, id));
  await pipeline.exec();

  nock('http://localhost:6000')
    .get('/feed.json?token=token&page_size=2&fresh_page_size=1&feed_version=5')
    .reply(200, tinybirdResponse);
  const page0 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
  });
  expect(page0).toEqual(['1', '2']);
  expect(nock.isDone()).toEqual(true);
});

it('should not fetch anonymous feed even when cache is still fresh', async () => {
  const key = getPersonalizedFeedKey();
  const pipeline = redisClient.pipeline();
  pipeline.set(`${key}:time`, new Date().toISOString());
  ['7', '8'].forEach((id, i) => pipeline.zadd(key, i, id));
  await pipeline.exec();

  nock('http://localhost:6000')
    .get('/feed.json?token=token&page_size=2&fresh_page_size=1&feed_version=5')
    .reply(200, tinybirdResponse);
  const page0 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
  });
  expect(page0).toEqual(['7', '8']);
  expect(nock.isDone()).toEqual(false);
});

it('should fetch anonymous feed when last updated time is greater than last generated time', async () => {
  const key = getPersonalizedFeedKey();
  const pipeline = redisClient.pipeline();
  pipeline.set(
    `${getPersonalizedFeedKeyPrefix()}:update`,
    new Date(new Date().getTime() - 10 * 1000).toISOString(),
  );
  pipeline.set(
    `${key}:time`,
    new Date(new Date().getTime() - 60 * 1000).toISOString(),
  );
  ['7', '8'].forEach((id, i) => pipeline.zadd(key, i, id));
  await pipeline.exec();

  nock('http://localhost:6000')
    .get('/feed.json?token=token&page_size=2&fresh_page_size=1&feed_version=5')
    .reply(200, tinybirdResponse);
  const page0 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
  });
  expect(page0).toEqual(['1', '2']);
  expect(nock.isDone()).toEqual(true);
});

it('should set the correct query parameters', async () => {
  await con.getRepository(Feed).save({ id: '1', userId: 'u1' });
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
  mockFeatures();
  nock('http://localhost:6000')
    .get(
      '/feed.json?token=token&page_size=2&fresh_page_size=1&feed_version=5&user_id=u1&allowed_tags=javascript,golang&blocked_tags=python,java&blocked_sources=a,b',
    )
    .reply(200, tinybirdResponse);
  const page0 = await generatePersonalizedFeed({
    con,
    pageSize: 2,
    offset: 0,
    feedVersion: 5,
    userId: 'u1',
    feedId: '1',
  });
  expect(page0).toEqual(['1', '2']);
  expect(nock.isDone()).toEqual(true);
});
