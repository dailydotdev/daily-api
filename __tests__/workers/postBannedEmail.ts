import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import { sendEmail } from '../../src/common';
import worker from '../../src/workers/postBannedEmail';
import { Post, Source, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { PostReport } from '../../src/entity/PostReport';
import { usersFixture } from '../fixture/user';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';

jest.mock('../../src/common/mailing', () => ({
  ...(jest.requireActual('../../src/common/mailing') as Record<
    string,
    unknown
  >),
  sendEmail: jest.fn(),
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
  await con.getRepository(User).save([usersFixture[0], usersFixture[1]]);
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

it('should send mail to the reporters', async () => {
  const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
  await expectSuccessfulBackground(worker, {
    post,
  });
  expect(sendEmail).toBeCalledTimes(1);
  expect(jest.mocked(sendEmail).mock.calls[0]).toMatchSnapshot();
});
