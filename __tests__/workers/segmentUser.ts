import { Connection, getConnection } from 'typeorm';
import { PubSub } from '@google-cloud/pubsub';
import { mocked } from 'ts-jest/utils';

import appFunc from '../../src/background';
import worker from '../../src/workers/segmentUser';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import { Post, PostKeyword, Source, TagSegment, View } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postKeywordsFixture, postsFixture } from '../fixture/post';
import { FastifyInstance } from 'fastify';

let con: Connection;
let app: FastifyInstance;

let mockTopic: jest.Mock;

jest.mock('@google-cloud/pubsub', () => {
  const mockTopic = jest.fn();
  return {
    ...(jest.requireActual('@google-cloud/pubsub') as object),
    PubSub: jest.fn().mockImplementation(() => ({ topic: mockTopic })),
  };
});

beforeAll(async () => {
  mockTopic = mocked(new PubSub().topic);
  jest.clearAllMocks();
  con = await getConnection();
  app = await appFunc();
  return app.ready();
});

const now = new Date();

beforeEach(async () => {
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
  await saveFixtures(con, PostKeyword, postKeywordsFixture);
  await con.getRepository(View).save([
    { userId: '1', timestamp: now, postId: postsFixture[0].id },
    {
      userId: '1',
      timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      postId: postsFixture[3].id,
    },
    {
      userId: '1',
      timestamp: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
      postId: postsFixture[4].id,
    },
    {
      userId: '2',
      timestamp: new Date(now.getTime() - 60 * 1000),
      postId: postsFixture[0].id,
    },
    {
      userId: '1',
      timestamp: new Date(now.getTime() - 65 * 24 * 60 * 60 * 1000),
      postId: postsFixture[2].id,
    },
  ]);
  await con.getRepository(TagSegment).save([
    { tag: 'html', segment: 'frontend' },
    { tag: 'javascript', segment: 'frontend' },
    { tag: 'backend', segment: 'backend' },
  ]);
});

it('should dispatch message with the right segment', async () => {
  const mockPublish = jest.fn().mockResolvedValue('');
  mockTopic.mockImplementation(() => ({ publishJSON: mockPublish }));

  await expectSuccessfulBackground(app, worker, { userId: '1' });
  expect(mockPublish).toBeCalledTimes(1);
  expect(mockPublish).toBeCalledWith({ userId: '1', segment: 'frontend' });
});

it('should not dispatch message when no segment found', async () => {
  const mockPublish = jest.fn().mockResolvedValue('');
  mockTopic.mockImplementation(() => ({ publishJSON: mockPublish }));

  await expectSuccessfulBackground(app, worker, { userId: '3' });
  expect(mockPublish).toBeCalledTimes(0);
});
