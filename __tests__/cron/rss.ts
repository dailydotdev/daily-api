import { Connection, getConnection } from 'typeorm';
import { PubSub } from '@google-cloud/pubsub';
import { mocked } from 'ts-jest/utils';

import cron from '../../src/cron/rss';
import {
  expectSuccessfulCron,
  saveFixtures,
  setupStaticServer,
} from '../helpers';
import { Source, SourceFeed } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { FastifyInstance } from 'fastify';
import appFunc from '../../src/background';

let con: Connection;
let app: FastifyInstance;
let staticApp: FastifyInstance;

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
  app = await appFunc();
  staticApp = await setupStaticServer('rss.xml');
  return app.ready();
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
  await staticApp.close();
});

it('should dispatch message for every new article', async () => {
  const mockPublish = jest.fn().mockResolvedValue('');
  mockTopic.mockImplementation(() => ({ publishJSON: mockPublish }));
  await expectSuccessfulCron(app, cron, {
    feed: 'http://localhost:6789/rss.xml',
  });
  expect(mockPublish.mock.calls).toMatchSnapshot();
  const feed = await con
    .getRepository(SourceFeed)
    .findOne({ feed: 'http://localhost:6789/rss.xml' });
  expect(feed.lastFetched).toEqual(new Date('Mon, 24 Aug 2020 20:49:54 +0000'));
});
