import { ReputationEvent } from './../../src/entity/ReputationEvent';
import { Connection, getConnection } from 'typeorm';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postScoutMatchedRep';
import {
  Post,
  Source,
  Submission,
  SubmissionStatus,
  User,
} from '../../src/entity';
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
      reputation: 3,
    },
    {
      id: '2',
      name: 'Lee',
      image: 'https://daily.dev/lee.jpg',
      reputation: 251,
    },
  ]);
  await con.getRepository(Post).update('p1', { scoutId: '1' });
});

const defaultSubmission: Partial<Submission> = {
  status: SubmissionStatus.Started,
  userId: '1',
  url: 'http://sample.abc.com',
};

it('should create a reputation event that increases reputation', async () => {
  const repo = con.getRepository(Submission);
  await repo.save(repo.create(defaultSubmission));
  await expectSuccessfulBackground(worker, {
    scoutId: '1',
    postId: 'p1',
  });
  const [event] = await con.getRepository(ReputationEvent).find();
  expect(event.amount).toEqual(100);
});

it('should not create a reputation event when the author is the scout itself', async () => {
  await con.getRepository(Post).update('p1', { authorId: '1' });
  await expectSuccessfulBackground(worker, {
    scoutId: '1',
    postId: 'p1',
  });

  const event = await con.getRepository(ReputationEvent).find();
  expect(event.length).toEqual(0);
});
