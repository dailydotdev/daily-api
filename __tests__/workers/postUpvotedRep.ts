import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postUpvotedRep';
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
  console.log(postsFixture[0]);
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
  ]);
  await con.getRepository(Post).update('p1', { authorId: '1' });
});

it('should create a reputation event that increases reputation', async () => {
  await expectSuccessfulBackground(worker, {
    userId: '2',
    postId: 'p1',
  });
  const event = await con
    .getRepository(ReputationEvent)
    .findOne({ where: { targetId: 'p1', grantById: '2', grantToId: '1' } });
  expect(event.amount).toEqual(10);
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

it('should not create a reputation event when the author is the upvote user', async () => {
  await expectSuccessfulBackground(worker, {
    userId: '1',
    postId: 'p1',
  });

  const event = await con
    .getRepository(ReputationEvent)
    .findOneBy({ targetId: 'p1', grantById: '2', grantToId: '1' });
  expect(event).toEqual(null);
});
