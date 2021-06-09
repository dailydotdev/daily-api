import { Connection, getConnection } from 'typeorm';
import { FastifyInstance } from 'fastify';

import appFunc from '../../src/background';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import { tweet } from '../../src/common';
import worker from '../../src/workers/postCommentedAuthorTweet';
import { Post, Source, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { mocked } from 'ts-jest/utils';

jest.mock('../../src/common/twitter', () => ({
  ...(jest.requireActual('../../src/common/twitter') as object),
  tweet: jest.fn(),
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
  await saveFixtures(con, Post, postsFixture);
  await con
    .getRepository(User)
    .save([{ id: '1', name: 'Ido', image: 'https://daily.dev/ido.jpg' }]);
});

it('should tweet about the new comment', async () => {
  await con
    .getRepository(Post)
    .update('p1', { creatorTwitter: '@idoshamun', comments: 23 });
  await expectSuccessfulBackground(app, worker, {
    postId: 'p1',
    userId: '1',
    commentId: 'c1',
  });
  expect(tweet).toBeCalledTimes(1);
  expect(mocked(tweet).mock.calls[0][0]).toContain('@idoshamun');
  expect(mocked(tweet).mock.calls[0][0]).toContain(
    'http://localhost:5002/posts/p1?author=true',
  );
  expect(mocked(tweet).mock.calls[0][0]).toContain('23');
  expect(mocked(tweet).mock.calls[0][1]).toEqual('AUTHOR_TWITTER');
});

it('should not tweet when no creator twitter', async () => {
  await expectSuccessfulBackground(app, worker, {
    postId: 'p1',
    userId: '1',
    commentId: 'c1',
  });
  expect(tweet).toBeCalledTimes(0);
});

it('should not tweet when author is matched', async () => {
  await con
    .getRepository(Post)
    .update('p1', { authorId: '1', creatorTwitter: '@idoshamun' });
  await expectSuccessfulBackground(app, worker, {
    postId: 'p1',
    userId: '1',
    commentId: 'c1',
  });
  expect(tweet).toBeCalledTimes(0);
});
