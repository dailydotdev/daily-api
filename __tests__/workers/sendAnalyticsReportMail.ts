import nock from 'nock';
import { Connection, getConnection } from 'typeorm';
import { FastifyInstance } from 'fastify';
import { mocked } from 'ts-jest/utils';

import appFunc from '../../src/background';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import { sendEmail, User as GatewayUser } from '../../src/common';
import worker from '../../src/workers/sendAnalyticsReportMail';
import { Post, Source, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { sub } from 'date-fns';

jest.mock('../../src/common/mailing', () => ({
  ...(jest.requireActual('../../src/common/mailing') as Record<
    string,
    unknown
  >),
  sendEmail: jest.fn(),
}));

let con: Connection;
let app: FastifyInstance;
const now = new Date();

beforeAll(async () => {
  con = await getConnection();
  app = await appFunc();
  return app.ready();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await con
    .getRepository(User)
    .save([{ id: '1', name: 'Ido', image: 'https://daily.dev/ido.jpg' }]);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, [
    {
      id: 'p1',
      shortId: 'sp1',
      title: 'P1',
      url: 'http://p1.com',
      sourceId: 'a',
      image: 'http://image.com/p',
      createdAt: sub(now, { hours: 10 }),
      authorId: '1',
      sentAnalyticsReport: false,
      upvotes: 6,
      views: 11,
      comments: 2,
    },
    {
      id: 'p2',
      shortId: 'sp2',
      title: 'P2',
      url: 'http://p2.com',
      sourceId: 'a',
      createdAt: sub(now, { hours: 30 }),
      authorId: '1',
      sentAnalyticsReport: true,
      upvotes: 5,
      views: 10,
      comments: 1,
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

it('should send analytics reports', async () => {
  const mockedUsers: GatewayUser[] = [
    {
      id: '1',
      email: 'ido@acme.com',
      name: 'Ido Shamun',
      image: 'https://daily.dev/ido.jpg',
      reputation: 5,
      permalink: 'https://daily.dev/ido',
      username: 'idoshamun',
    },
  ];
  mockedUsers.forEach(mockUsersMe);

  await expectSuccessfulBackground(app, worker, {
    postId: 'p1',
  });
  expect(sendEmail).toBeCalledTimes(1);
  expect(mocked(sendEmail).mock.calls[0]).toMatchSnapshot();
  const post = await con.getRepository(Post).findOne('p1');
  expect(post.sentAnalyticsReport).toEqual(true);
});
