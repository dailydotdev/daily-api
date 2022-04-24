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
      reputation: 250,
    },
  ]);
  await con.getRepository(Post).update('p1', { authorId: '1' });
});

it('should delete the reputation event relevant to granting of reputation', async () => {
  const repo = con.getRepository(ReputationEvent);
  await repo.save(
    repo.create({
      grantById: '2',
      grantToId: '1',
      targetId: 'p1',
      targetType: ReputationType.Post,
      reason: ReputationReason.PostUpvoted,
    }),
  );
  await expectSuccessfulBackground(worker, {
    userId: '2',
    postId: 'p1',
  });
  const events = await repo.find();
  expect(events.length).toEqual(0);
});
