import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postDownvoteCanceledRep';
import {
  ArticlePost,
  Post,
  Source,
  User,
  ReputationEvent,
  ReputationType,
  ReputationReason,
} from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { typedWorkers } from '../../src/workers';

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
      reputation: 250,
    },
  ]);
  await con.getRepository(Post).update('p1', { authorId: '1' });
});
describe('postDownvoteCanceledRep worker', () => {
  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });
  it('should delete the reputation event relevant to downvoting post', async () => {
    const repo = con.getRepository(ReputationEvent);
    await repo.save(
      repo.create({
        grantById: '2',
        grantToId: '1',
        targetId: 'p1',
        targetType: ReputationType.Post,
        reason: ReputationReason.PostDownvoted,
      }),
    );
    await expectSuccessfulTypedBackground(worker, {
      userId: '2',
      postId: 'p1',
    });
    const events = await repo.find();
    expect(events.length).toEqual(0);
  });

  it('should delete scout reputation event relevant to granting of reputation', async () => {
    await con.getRepository(User).save([
      {
        id: '3',
        name: 'Scout',
        image: 'https://daily.dev/scout.jpg',
        reputation: 250,
      },
    ]);
    await con.getRepository(Post).update('p1', { scoutId: '3' });
    const repo = con.getRepository(ReputationEvent);
    await repo.save([
      repo.create({
        grantById: '2',
        grantToId: '3',
        targetId: 'p1',
        targetType: ReputationType.Post,
        reason: ReputationReason.PostDownvoted,
      }),
    ]);
    await expectSuccessfulTypedBackground(worker, {
      userId: '2',
      postId: 'p1',
    });
    const event = await repo.findOneBy({
      grantById: '2',
      grantToId: '3',
      targetId: 'p1',
      targetType: ReputationType.Post,
      reason: ReputationReason.PostDownvoted,
    });
    expect(event).toBeNull();
  });
});
