import nock from 'nock';
import { Connection, getConnection } from 'typeorm';
import { FastifyInstance } from 'fastify';
import { mocked } from 'ts-jest/utils';

import appFunc from '../../src/background';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import { sendEmail } from '../../src/common';
import { User as GatewayUser } from '../../src/common/users';
import worker from '../../src/workers/commentCommentedThread';
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
    { id: '3', name: 'Nimrod', image: 'https://daily.dev/nimrod.jpg' },
    { id: '4', name: 'John', image: 'https://daily.dev/john.jpg' },
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
      content: 'sub comment2',
      createdAt: new Date(2020, 1, 6, 0, 0),
      parentId: 'c1',
    },
    {
      id: 'c4',
      postId: 'p1',
      userId: '3',
      content: 'sub comment3',
      createdAt: new Date(2020, 1, 6, 0, 0),
      parentId: 'c1',
    },
    {
      id: 'c5',
      postId: 'p1',
      userId: '4',
      content: 'sub comment4',
      createdAt: new Date(2020, 1, 6, 0, 0),
      parentId: 'c1',
    },
  ]);
});

const mockUsersMe = (user: GatewayUser): nock.Scope =>
  nock(process.env.GATEWAY_URL)
    .get('/v1/users/me')
    .matchHeader('authorization', `Service ${process.env.GATEWAY_SECRET}`)
    .matchHeader('user-id', user.id)
    .matchHeader('logged-in', 'true')
    .reply(200, user);

it('should send mail to the thread followers', async () => {
  const mockedUsers: GatewayUser[] = [
    {
      id: '1',
      email: 'ido@acme.com',
      name: 'Ido',
      image: 'https://daily.dev/ido.jpg',
      reputation: 5,
      permalink: 'https://daily.dev/ido',
    },
    {
      id: '2',
      email: 'tsahi@acme.com',
      name: 'Tsahi',
      image: 'https://daily.dev/tsahi.jpg',
      reputation: 3,
      permalink: 'https://daily.dev/tsahi',
    },
    {
      id: '3',
      email: 'nimrod@acme.com',
      name: 'Nimrod',
      image: 'https://daily.dev/nimrod.jpg',
      reputation: 1,
      permalink: 'https://daily.dev/nimrod',
    },
    {
      id: '4',
      email: 'john@acme.com',
      name: 'John',
      image: 'https://daily.dev/john.jpg',
      reputation: 0,
      permalink: 'https://daily.dev/john',
    },
  ];
  mockedUsers.forEach(mockUsersMe);

  await expectSuccessfulBackground(app, worker, {
    postId: 'p1',
    userId: '4',
    childCommentId: 'c5',
    parentCommentId: 'c1',
  });
  expect(sendEmail).toBeCalledTimes(1);
  expect(mocked(sendEmail).mock.calls[0]).toMatchSnapshot();
});

it('should send mail to the thread followers without the post author', async () => {
  const mockedUsers: GatewayUser[] = [
    {
      id: '1',
      email: 'ido@acme.com',
      name: 'Ido',
      image: 'https://daily.dev/ido.jpg',
      reputation: 5,
      permalink: 'https://daily.dev/ido',
    },
    {
      id: '2',
      email: 'tsahi@acme.com',
      name: 'Tsahi',
      image: 'https://daily.dev/tsahi.jpg',
      reputation: 3,
      permalink: 'https://daily.dev/tsahi',
    },
    {
      id: '3',
      email: 'nimrod@acme.com',
      name: 'Nimrod',
      image: 'https://daily.dev/nimrod.jpg',
      reputation: 1,
      permalink: 'https://daily.dev/nimrod',
    },
    {
      id: '4',
      email: 'john@acme.com',
      name: 'John',
      image: 'https://daily.dev/john.jpg',
      reputation: 0,
      permalink: 'https://daily.dev/john',
    },
  ];
  mockedUsers.forEach(mockUsersMe);

  await con.getRepository(Post).update('p1', { authorId: '2' });
  await expectSuccessfulBackground(app, worker, {
    postId: 'p1',
    userId: '4',
    childCommentId: 'c5',
    parentCommentId: 'c1',
  });
  expect(sendEmail).toBeCalledTimes(1);
  expect(mocked(sendEmail).mock.calls[0]).toMatchSnapshot();
});
