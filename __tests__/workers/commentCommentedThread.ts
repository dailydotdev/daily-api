import { Connection, getConnection } from 'typeorm';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import { sendEmail } from '../../src/common';
import worker from '../../src/workers/commentCommentedThread';
import { Comment, Post, Source, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { usersFixture } from '../fixture/user';

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
  await saveFixtures(con, User, usersFixture);
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

it('should send mail to the thread followers', async () => {
  await expectSuccessfulBackground(worker, {
    postId: 'p1',
    userId: '4',
    childCommentId: 'c5',
    parentCommentId: 'c1',
  });
  expect(sendEmail).toBeCalledTimes(1);
  expect(jest.mocked(sendEmail).mock.calls[0]).toMatchSnapshot();
});

it('should send mail to the thread followers without the post author', async () => {
  await con.getRepository(Post).update('p1', { authorId: '2' });
  await expectSuccessfulBackground(worker, {
    postId: 'p1',
    userId: '4',
    childCommentId: 'c5',
    parentCommentId: 'c1',
  });
  expect(sendEmail).toBeCalledTimes(1);
  expect(jest.mocked(sendEmail).mock.calls[0]).toMatchSnapshot();
});
