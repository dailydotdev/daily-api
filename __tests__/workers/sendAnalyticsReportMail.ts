import { Connection, getConnection } from 'typeorm';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import { sendEmail } from '../../src/common';
import worker from '../../src/workers/sendAnalyticsReportMail';
import { Post, Source, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { sub } from 'date-fns';
import { usersFixture } from '../fixture/user';

jest.mock('../../src/common/mailing', () => ({
  ...(jest.requireActual('../../src/common/mailing') as Record<
    string,
    unknown
  >),
  sendEmail: jest.fn(),
}));

let con: Connection;

const now = new Date();

beforeAll(async () => {
  con = await getConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await con.getRepository(User).save([usersFixture[0], usersFixture[1]]);
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
      image: 'http://image.com/p2',
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

it('should send analytics reports', async () => {
  await expectSuccessfulBackground(worker, {
    postId: 'p2',
  });
  expect(sendEmail).toBeCalledTimes(1);
  expect(jest.mocked(sendEmail).mock.calls[0]).toMatchSnapshot();
});

it('should send analytics reports to both scout and author', async () => {
  await con
    .getRepository(Post)
    .update({ id: 'p1' }, { scoutId: '2', sentAnalyticsReport: true });

  await expectSuccessfulBackground(worker, {
    postId: 'p1',
  });
  expect(sendEmail).toBeCalledTimes(1);
  expect(jest.mocked(sendEmail).mock.calls[0]).toMatchSnapshot();
});
