import { ReputationEvent } from './../../src/entity/ReputationEvent';
import { Connection, getConnection } from 'typeorm';

import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postBannedRep';
import { COMMUNITY_PICKS_SOURCE, Post, Source, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { PostReport } from '../../src/entity/PostReport';

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
      reputation: 3,
    },
    {
      id: '2',
      name: 'Tsahi',
      image: 'https://daily.dev/tsahi.jpg',
      reputation: 6,
    },
  ]);
  await con.getRepository(PostReport).insert([
    { postId: 'p1', userId: '1', reason: 'BROKEN' },
    { postId: 'p1', userId: '2', reason: 'CLICKBAIT' },
  ]);
});

it('should create a reputation event that increases reputation', async () => {
  const post = await con.getRepository(Post).findOne('p1');
  await expectSuccessfulBackground(worker, {
    post,
  });
  const events = await con
    .getRepository(ReputationEvent)
    .find({ where: { targetId: 'p1', grantById: '' } });
  expect(events[0].amount).toEqual(100);
  expect(events[1].amount).toEqual(100);
});

it('should ignore banning of community picks', async () => {
  const post = await con.getRepository(Post).findOne('p1');
  post.sourceId = COMMUNITY_PICKS_SOURCE;
  await expectSuccessfulBackground(worker, {
    post,
  });
  const events = await con
    .getRepository(ReputationEvent)
    .find({ where: { targetId: 'p1', grantById: '' } });
  expect(events.length).toEqual(0);
});
