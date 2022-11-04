import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import { sendEmail } from '../../src/common';
import worker from '../../src/workers/postAuthorMatchedMail';
import { Post, Source, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
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
  await con.getRepository(User).save([usersFixture[0]]);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, [
    {
      id: 'p1',
      shortId: 'sp1',
      title: 'P1',
      url: 'http://p1.com',
      score: 0,
      sourceId: 'a',
      createdAt: new Date(2020, 8, 27),
      image: 'https://daily.dev/image.jpg',
    },
  ]);
});

it('should send post author matched mail', async () => {
  await expectSuccessfulBackground(worker, {
    postId: 'p1',
    authorId: '1',
  });
  expect(sendEmail).toBeCalledTimes(1);
  expect(jest.mocked(sendEmail).mock.calls[0]).toMatchSnapshot();
});
