import nock from 'nock';
import { Connection, getConnection } from 'typeorm';

import { mocked } from 'ts-jest/utils';

import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import { sendEmail } from '../../src/common';
import worker from '../../src/workers/commentUpvoted';
import { Comment, Post, Source, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';

jest.mock('../../src/common/mailing', () => ({
  ...(jest.requireActual('../../src/common/mailing') as Record<
    string,
    unknown
  >),
  sendEmail: jest.fn(),
}));

let con: Connection;

beforeAll(async () => {
  con = await getConnection();
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
      userId: '1',
      content: 'parent comment',
      createdAt: new Date(2020, 1, 6, 0, 0),
      upvotes: 2,
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
      permalink: 'https://daily.dev/ido',
    });

  await expectSuccessfulBackground(worker, {
    userId: '2',
    commentId: 'c1',
  });
  expect(sendEmail).toBeCalledTimes(1);
  expect(mocked(sendEmail).mock.calls[0]).toMatchSnapshot();
});

it('should not send mail when the author is the upvote user', async () => {
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

  await expectSuccessfulBackground(worker, {
    userId: '1',
    commentId: 'c1',
  });
  expect(sendEmail).toBeCalledTimes(0);
});

it('should not send mail when number of upvotes is not a defined trigger', async () => {
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

  await expectSuccessfulBackground(worker, {
    userId: '1',
    commentId: 'c2',
  });
  expect(sendEmail).toBeCalledTimes(0);
});
