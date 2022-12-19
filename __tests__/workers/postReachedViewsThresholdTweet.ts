import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import { tweet } from '../../src/common';
import worker from '../../src/workers/postReachedViewsThresholdTweet';
import { ArticlePost, Source, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';

jest.mock('../../src/common/twitter', () => ({
  ...(jest.requireActual('../../src/common/twitter') as Record<
    string,
    unknown
  >),
  tweet: jest.fn(),
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await con
    .getRepository(User)
    .save([{ id: '1', name: 'Ido', image: 'https://daily.dev/ido.jpg' }]);
});

it('should tweet about the trending post', async () => {
  await con
    .getRepository(ArticlePost)
    .update('p1', { creatorTwitter: '@idoshamun' });
  await expectSuccessfulBackground(worker, {
    postId: 'p1',
    threshold: 250,
  });
  expect(tweet).toBeCalledTimes(1);
  expect(jest.mocked(tweet).mock.calls[0][0]).toContain('@idoshamun');
  expect(jest.mocked(tweet).mock.calls[0][0]).toContain(
    'http://localhost:5002/posts/p1?author=true',
  );
  expect(jest.mocked(tweet).mock.calls[0][1]).toEqual('AUTHOR_TWITTER');
});

it('should not tweet when no creator twitter', async () => {
  await expectSuccessfulBackground(worker, {
    postId: 'p1',
    threshold: 250,
  });
  expect(tweet).toBeCalledTimes(0);
});

it('should not tweet when author is matched', async () => {
  await con
    .getRepository(ArticlePost)
    .update('p1', { authorId: '1', creatorTwitter: '@idoshamun' });
  await expectSuccessfulBackground(worker, {
    postId: 'p1',
    userId: '1',
    commentId: 'c1',
  });
  expect(tweet).toBeCalledTimes(0);
});
