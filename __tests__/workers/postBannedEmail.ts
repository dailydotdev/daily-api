import nock from 'nock';
import { Connection, getConnection } from 'typeorm';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import { sendEmail } from '../../src/common';
import { User as GatewayUser } from '../../src/common/users';
import worker from '../../src/workers/postBannedEmail';
import { Post, Source, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { PostReport } from '../../src/entity/PostReport';

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
  await con.getRepository(PostReport).insert([
    {
      postId: 'p1',
      userId: '1',
      reason: 'BROKEN',
      createdAt: new Date(2021, 4, 6, 13, 36, 26),
    },
    {
      postId: 'p1',
      userId: '2',
      reason: 'CLICKBAIT',
      createdAt: new Date(2021, 4, 5, 12, 36, 26),
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

  const post = await con.getRepository(Post).findOne('p1');
  await expectSuccessfulBackground(worker, {
    post,
  });
  expect(sendEmail).toBeCalledTimes(1);
  expect(jest.mocked(sendEmail).mock.calls[0]).toMatchSnapshot();
});
