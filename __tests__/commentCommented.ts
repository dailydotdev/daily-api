import nock from 'nock';
import { Connection, getConnection } from 'typeorm';
import { PubSub } from '@google-cloud/pubsub';
import { FastifyInstance } from 'fastify';
import { mocked } from 'ts-jest/utils';

import appFunc from '../src';
import { mockMessage, saveFixtures } from './helpers';
import { sendEmail } from '../src/common/mailing';
import worker from '../src/workers/commentCommented';
import { Comment, Post, Source, User } from '../src/entity';
import { sourcesFixture } from './fixture/source';
import { postsFixture } from './fixture/post';

jest.mock('../src/common/mailing', () => ({
  ...jest.requireActual('../src/common/mailing'),
  sendEmail: jest.fn(),
}));

let con: Connection;
let app: FastifyInstance;

beforeAll(async () => {
  con = await getConnection();
  app = await appFunc();
  return app.ready();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
  await con.getRepository(User).save([
    { id: '1', name: 'Ido', image: 'https://daily.dev/ido.jpg' },
    { id: '2', name: 'Tsahi', image: 'https://daily.dev/tsahi.jpg' },
  ]);
  await con.getRepository(Comment).save([
    {
      id: 'c1',
      postId: 'p1',
      userId: '1',
      content: 'parent comment',
      createdAt: new Date(2020, 1, 6, 0, 0),
      upvotes: 1,
    },
    {
      id: 'c2',
      postId: 'p1',
      userId: '2',
      content: 'sub comment',
      createdAt: new Date(2020, 1, 6, 0, 0),
      parentId: 'c1',
    },
    {
      id: 'c3',
      postId: 'p1',
      userId: '1',
      content: 'sub comment',
      createdAt: new Date(2020, 1, 6, 0, 0),
      parentId: 'c1',
    },
  ]);
});

it('should send mail to author', async () => {
  nock(process.env.GATEWAY_URL)
    .get('/v1/users/me')
    .matchHeader('authorization', `Service ${process.env.GATEWAY_SECRET}`)
    .matchHeader('user-id', '1')
    .matchHeader('logged-in', 'true')
    .reply(200, {
      id: '1',
      email: 'ido@daily.dev',
      name: 'Ido',
      image: 'https://daily.dev/ido.jpg',
    });

  nock(process.env.GATEWAY_URL)
    .get('/v1/users/me')
    .matchHeader('authorization', `Service ${process.env.GATEWAY_SECRET}`)
    .matchHeader('user-id', '2')
    .matchHeader('logged-in', 'true')
    .reply(200, {
      id: '2',
      email: 'tsahi@daily.dev',
      name: 'Tsahi',
      image: 'https://daily.dev/tsahi.jpg',
    });

  const message = mockMessage({
    postId: 'p1',
    userId: '2',
    childCommentId: 'c2',
    parentCommentId: 'c1',
  });

  await worker.handler(message, con, app.log, new PubSub());
  expect(message.ack).toBeCalledTimes(1);
  expect(sendEmail).toBeCalledTimes(1);
  expect(mocked(sendEmail).mock.calls[0]).toMatchSnapshot();
});

it('should not send mail when the author is the commenter user', async () => {
  nock(process.env.GATEWAY_URL)
    .get('/v1/users/me')
    .matchHeader('authorization', `Service ${process.env.GATEWAY_SECRET}`)
    .matchHeader('user-id', '1')
    .matchHeader('logged-in', 'true')
    .reply(200, {
      id: '1',
      email: 'ido@daily.dev',
      name: 'Ido',
      image: 'https://daily.dev/ido.jpg',
    });

  nock(process.env.GATEWAY_URL)
    .get('/v1/users/me')
    .matchHeader('authorization', `Service ${process.env.GATEWAY_SECRET}`)
    .matchHeader('user-id', '1')
    .matchHeader('logged-in', 'true')
    .reply(200, {
      id: '1',
      email: 'ido@daily.dev',
      name: 'Ido',
      image: 'https://daily.dev/ido.jpg',
    });

  const message = mockMessage({
    postId: 'p1',
    userId: '1',
    childCommentId: 'c3',
    parentCommentId: 'c1',
  });

  await worker.handler(message, con, app.log, new PubSub());
  expect(message.ack).toBeCalledTimes(1);
  expect(sendEmail).toBeCalledTimes(0);
});
