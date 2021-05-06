import nock from 'nock';
import { Connection, getConnection } from 'typeorm';
import { FastifyInstance } from 'fastify';
import { mocked } from 'ts-jest/utils';

import appFunc from '../../src/background';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import { sendEmail } from '../../src/common';
import { User as GatewayUser } from '../../src/common/users';
import worker from '../../src/workers/postBannedEmail';
import { Post, Source, SourceDisplay, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { sourceDisplaysFixture } from '../fixture/sourceDisplay';
import { PostReport } from '../../src/entity/PostReport';

jest.mock('../../src/common/mailing', () => ({
  ...jest.requireActual('../../src/common/mailing'),
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
  await saveFixtures(con, SourceDisplay, sourceDisplaysFixture);
  await saveFixtures(con, Post, postsFixture);
  await con.getRepository(User).save([
    { id: '1', name: 'Ido', image: 'https://daily.dev/ido.jpg' },
    { id: '2', name: 'Tsahi', image: 'https://daily.dev/tsahi.jpg' },
  ]);
  await con.getRepository(PostReport).insert([
    { postId: 'p1', userId: '1', reason: 'BROKEN' },
    { postId: 'p1', userId: '2', reason: 'CLICKBAIT' },
  ]);
});

const mockUsersMe = (user: GatewayUser): nock.Scope =>
  nock(process.env.GATEWAY_URL)
    .get('/v1/users/me')
    .matchHeader('authorization', `Service ${process.env.GATEWAY_SECRET}`)
    .matchHeader('user-id', user.id)
    .matchHeader('logged-in', 'true')
    .reply(200, user);

it('should send mail to the reporters', async () => {
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
  ];
  mockedUsers.forEach(mockUsersMe);

  await expectSuccessfulBackground(app, worker, {
    postId: 'p1',
  });
  expect(sendEmail).toBeCalledTimes(1);
  expect(mocked(sendEmail).mock.calls[0]).toMatchSnapshot();
});
