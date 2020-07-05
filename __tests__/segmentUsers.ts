import { Connection, getConnection } from 'typeorm';
import { PubSub } from '@google-cloud/pubsub';
import { mocked } from 'ts-jest/utils';

import cron from '../src/cron/segmentUsers';
import { saveFixtures } from './helpers';
import { Post, Source, View } from '../src/entity';
import { sourcesFixture } from './fixture/source';
import { postsFixture } from './fixture/post';

let con: Connection;

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
});

const now = new Date();

beforeEach(async () => {
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
  await con.getRepository(View).save([
    { userId: '1', timestamp: now, postId: postsFixture[0].id },
    {
      userId: '2',
      timestamp: new Date(now.getTime() - 60 * 1000),
      postId: postsFixture[0].id,
    },
    {
      userId: '3',
      timestamp: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      postId: postsFixture[1].id,
    },
    {
      userId: '1',
      timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      postId: postsFixture[2].id,
    },
  ]);
});

it('should dispatch message for every user who read an article', async () => {
  const mockPublish = jest.fn().mockResolvedValue('');
  mockTopic.mockImplementation(() => ({ publishJSON: mockPublish }));
  await cron.handler(con);
  expect(mockPublish).toBeCalledTimes(2);
  expect(mockPublish).toBeCalledWith({ userId: '1' });
  expect(mockPublish).toBeCalledWith({ userId: '2' });
});
