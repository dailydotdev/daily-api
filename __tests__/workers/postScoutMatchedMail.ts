import { Connection, getConnection } from 'typeorm';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import { sendEmail } from '../../src/common';
import worker from '../../src/workers/postScoutMatchedMail';
import {
  Post,
  Source,
  Submission,
  SubmissionStatus,
  User,
} from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { usersFixture } from '../fixture/user';
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

const defaultPost = postsFixture[0];
const defaultUser = usersFixture[0];

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, User, [{ ...defaultUser }]);
  await saveFixtures(con, Post, [defaultPost]);
});

it('should send post scout matched mail', async () => {
  await con.getRepository(Submission).save({
    status: SubmissionStatus.Accepted,
    url: defaultPost.url,
    userId: '1',
    createdAt: new Date(2020, 8, 25),
  });
  await expectSuccessfulBackground(worker, {
    postId: 'p1',
    scoutId: '1',
  });
  expect(sendEmail).toBeCalledTimes(1);
  expect(jest.mocked(sendEmail).mock.calls[0]).toMatchSnapshot();
});
