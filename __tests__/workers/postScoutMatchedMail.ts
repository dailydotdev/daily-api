import nock from 'nock';
import { Connection, getConnection } from 'typeorm';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import { sendEmail, User as GatewayUser } from '../../src/common';
import worker from '../../src/workers/postScoutMatchedMail';
import {
  Post,
  Source,
  Submission,
  SubmissionStatus,
  User,
} from '../../src/entity';
import { sourcesFixture } from '../fixture/source';

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

const defaultPost = {
  id: 'p1',
  shortId: 'sp1',
  title: 'P1',
  url: 'http://p1.com',
  score: 0,
  sourceId: 'a',
  scoutId: '1',
  createdAt: new Date(2020, 8, 27),
  image: 'https://daily.dev/image.jpg',
};

const defaultUser = {
  id: '1',
  email: 'lee@acme.com',
  name: 'Lee',
  image: 'https://daily.dev/lee.jpg',
  reputation: 5,
  permalink: 'https://daily.dev/lee',
};

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, User, [defaultUser]);
  await saveFixtures(con, Post, [defaultPost]);
});

const mockUsersMe = (user: GatewayUser): nock.Scope =>
  nock(process.env.GATEWAY_URL)
    .get('/v1/users/me')
    .matchHeader('authorization', `Service ${process.env.GATEWAY_SECRET}`)
    .matchHeader('user-id', user.id)
    .matchHeader('logged-in', 'true')
    .reply(200, user);

it('should send post scout matched mail', async () => {
  const mockedUsers: GatewayUser[] = [defaultUser];
  await con.getRepository(Submission).save({
    status: SubmissionStatus.Accepted,
    url: defaultPost.url,
    userId: '1',
    createdAt: new Date(2020, 8, 25),
  });
  mockedUsers.forEach(mockUsersMe);
  await expectSuccessfulBackground(worker, {
    postId: 'p1',
    scoutId: '1',
  });
  expect(sendEmail).toBeCalledTimes(1);
  expect(jest.mocked(sendEmail).mock.calls[0]).toMatchSnapshot();
});
