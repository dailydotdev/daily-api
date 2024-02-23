import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postDownvotedRep';
import {
  ArticlePost,
  Post,
  Source,
  User,
  ReputationEvent,
} from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await con.getRepository(User).save([
    {
      id: '1',
      name: 'Ido',
      image: 'https://daily.dev/ido.jpg',
      reputation: 3,
    },
    {
      id: '2',
      name: 'Lee',
      image: 'https://daily.dev/lee.jpg',
      reputation: 251,
    },
    {
      id: '3',
      name: 'Chris',
      image: 'https://daily.dev/chris.jpg',
      reputation: 251,
    },
  ]);
  await con.getRepository(Post).update('p1', { authorId: '1' });
});

it('should create a reputation event that decreases reputation', async () => {
  await expectSuccessfulBackground(worker, {
    userId: '2',
    postId: 'p1',
  });
  const event = await con
    .getRepository(ReputationEvent)
    .findOne({ where: { targetId: 'p1', grantById: '2', grantToId: '1' } });
  expect(event.amount).toEqual(-10);
});

it('should not create a reputation event when the upvoting user is ineligible', async () => {
  await con.getRepository(User).update({ id: '2' }, { reputation: 249 });
  await expectSuccessfulBackground(worker, {
    userId: '2',
    postId: 'p1',
  });
  const event = await con
    .getRepository(ReputationEvent)
    .findOneBy({ targetId: 'p1', grantById: '2', grantToId: '1' });
  expect(event).toEqual(null);
});

it('should not create a reputation event when the author is the downvoted user', async () => {
  await expectSuccessfulBackground(worker, {
    userId: '1',
    postId: 'p1',
  });

  const event = await con
    .getRepository(ReputationEvent)
    .findOneBy({ targetId: 'p1', grantById: '2', grantToId: '1' });
  expect(event).toEqual(null);
});

it('should not create a reputation event for author when there is a scout set for the post', async () => {
  await con.getRepository(Post).update('p1', { scoutId: '2' });
  await expectSuccessfulBackground(worker, {
    userId: '3',
    postId: 'p1',
  });

  const event = await con
    .getRepository(ReputationEvent)
    .findBy({ targetId: 'p1', grantById: '3' });
  expect(event.length).toEqual(1);
  expect(event[0].grantToId).toEqual('2');
});
