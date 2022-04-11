import {
  ReputationEvent,
  ReputationType,
  ReputationReason,
} from './../../src/entity/ReputationEvent';
import { Connection, getConnection } from 'typeorm';

import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postUpvoteCanceledRep';
import { Post, Source, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';

let con: Connection;

beforeAll(async () => {
  con = await getConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
  await con.getRepository(User).save([
    {
      id: '1',
      name: 'Ido',
      image: 'https://daily.dev/ido.jpg',
      reputation: 50,
    },
  ]);
  await con.getRepository(Post).update('p1', { authorId: '1' });
});

it('should decrease reputation and notify', async () => {
  const repo = con.getRepository(ReputationEvent);
  await repo.save(
    repo.create({
      grantById: '2',
      grantToId: '1',
      targetId: 'p1',
      targetType: ReputationType.Post,
      reason: ReputationReason.PostUpvote,
    }),
  );
  await expectSuccessfulBackground(worker, {
    userId: '2',
    postId: 'p1',
  });
  const user = await con.getRepository(User).findOne('1');
  expect(user.reputation).toEqual(40);
});

it('should not decrease reputation when the author is the upvote user', async () => {
  await expectSuccessfulBackground(worker, {
    userId: '1',
    postId: 'p1',
  });
  const user = await con.getRepository(User).findOne('1');
  expect(user.reputation).toEqual(50);
});
