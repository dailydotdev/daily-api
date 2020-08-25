import { Connection, getConnection } from 'typeorm';
import { PubSub } from '@google-cloud/pubsub';
import { mocked } from 'ts-jest/utils';

import cron from '../src/cron/rss';
import { saveFixtures, setupStaticServer } from './helpers';
import { Source, SourceFeed } from '../src/entity';
import { sourcesFixture } from './fixture/source';
import { FastifyInstance } from 'fastify';

let con: Connection;
let app: FastifyInstance;

let mockTopic: jest.Mock;

jest.mock('@google-cloud/pubsub', () => {
  const mockTopic = jest.fn();
  return {
    PubSub: jest.fn().mockImplementation(() => ({ topic: mockTopic })),
  };
});

beforeAll(async () => {
  mockTopic = mocked(new PubSub().topic);
  jest.clearAllMocks();
  con = await getConnection();
  app = await setupStaticServer('rss.xml');
});

beforeEach(async () => {
  await saveFixtures(con, Source, sourcesFixture);
  await con.getRepository(SourceFeed).save({
    sourceId: 'a',
    feed: 'http://localhost:6789/rss.xml',
    lastFetched: new Date('Mon, 24 Aug 2020 14:07:41 +0000'),
  });
});

afterAll(async () => {
  await app.close();
});

it('should dispatch message for every new article', async () => {
  const mockPublish = jest.fn().mockResolvedValue('');
  mockTopic.mockImplementation(() => ({ publishJSON: mockPublish }));
  await cron.handler(con, 'http://localhost:6789/rss.xml');
  expect(mockPublish.mock.calls).toMatchSnapshot();
  const feed = await con
    .getRepository(SourceFeed)
    .findOne({ feed: 'http://localhost:6789/rss.xml' });
  expect(feed.lastFetched).toEqual(new Date('Mon, 24 Aug 2020 20:49:54 +0000'));
});
