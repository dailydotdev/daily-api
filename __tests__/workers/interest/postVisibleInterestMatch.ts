import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { expectSuccessfulTypedBackground, saveFixtures } from '../../helpers';
import { postVisibleInterestMatchWorker as worker } from '../../../src/workers/interest/postVisibleInterestMatch';
import { typedWorkers } from '../../../src/workers';
import { ArticlePost, Source, User } from '../../../src/entity';
import { Feed } from '../../../src/entity/Feed';
import { FeedTag } from '../../../src/entity/FeedTag';
import { PostKeyword } from '../../../src/entity/PostKeyword';
import { Keyword, KeywordStatus } from '../../../src/entity/Keyword';
import {
  UserInterest,
  UserInterestStatus,
} from '../../../src/entity/UserInterest';
import { InterestFinding } from '../../../src/entity/InterestFinding';
import { usersFixture } from '../../fixture/user';
import { postsFixture } from '../../fixture/post';
import { sourcesFixture } from '../../fixture';
import { toChangeObject } from '../../../src/common/utils';
import { triggerTypedEvent } from '../../../src/common/typedPubsub';
import type { Post } from '../../../src/entity/posts/Post';

jest.mock('../../../src/common/interest/runInterestAgent', () => ({
  runInterestAgent: jest.fn(),
}));

jest.mock('../../../src/common/typedPubsub', () => ({
  ...(jest.requireActual('../../../src/common/typedPubsub') as Record<
    string,
    unknown
  >),
  triggerTypedEvent: jest.fn(),
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await saveFixtures(con, Keyword, [
    { value: 'zig', status: KeywordStatus.Allow, occurrences: 1 },
  ]);
  await con.getRepository(PostKeyword).save({
    postId: 'p1',
    keyword: 'zig',
    status: 'allow',
  });
  await con.getRepository(Feed).save({ id: 'feed-1', userId: '1', flags: {} });
  await con.getRepository(UserInterest).save({
    id: 'uir-1',
    userId: '1',
    query: 'cool zig projects',
    status: UserInterestStatus.Active,
    feedId: 'feed-1',
    fomoThreshold: 0.5,
    sources: { dailyDev: true, web: false, github: false },
    outputModes: { feed: true, post: true, digest: false, notification: true },
  });
});

const getPost = async () =>
  toChangeObject(
    (await con
      .getRepository(ArticlePost)
      .findOneByOrFail({ id: 'p1' })) as unknown as Post,
  );

describe('postVisibleInterestMatch worker', () => {
  it('is registered in typedWorkers', () => {
    const registered = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );
    expect(registered).toBeTruthy();
  });

  it('adds a finding and notifies when a new post overlaps interest tags', async () => {
    await con.getRepository(FeedTag).save({ feedId: 'feed-1', tag: 'zig' });

    await expectSuccessfulTypedBackground<'api.v1.post-visible'>(worker, {
      post: await getPost(),
    });

    const finding = await con
      .getRepository(InterestFinding)
      .findOneBy({ interestId: 'uir-1', postId: 'p1' });
    expect(finding).toBeTruthy();

    const call = (triggerTypedEvent as jest.Mock).mock.calls.find(
      (c) => c[1] === 'api.v1.interest-content-available',
    );
    expect(call?.[2]).toEqual({
      interestId: 'uir-1',
      postId: 'p1',
      userId: '1',
    });
  });

  it('does nothing when tags do not overlap', async () => {
    await con.getRepository(FeedTag).save({ feedId: 'feed-1', tag: 'rust' });

    await expectSuccessfulTypedBackground<'api.v1.post-visible'>(worker, {
      post: await getPost(),
    });

    const finding = await con
      .getRepository(InterestFinding)
      .findOneBy({ interestId: 'uir-1', postId: 'p1' });
    expect(finding).toBeNull();
    expect(triggerTypedEvent).not.toHaveBeenCalled();
  });

  it('skips when the audienceFit score is below the FOMO threshold', async () => {
    await con.getRepository(FeedTag).save({ feedId: 'feed-1', tag: 'zig' });
    await con
      .getRepository(UserInterest)
      .update({ id: 'uir-1' }, { fomoThreshold: 0.95 });

    await expectSuccessfulTypedBackground<'api.v1.post-visible'>(worker, {
      post: await getPost(),
    });

    const finding = await con
      .getRepository(InterestFinding)
      .findOneBy({ interestId: 'uir-1', postId: 'p1' });
    expect(finding).toBeNull();
  });

  it('skips private posts', async () => {
    await con.getRepository(FeedTag).save({ feedId: 'feed-1', tag: 'zig' });
    const post = await getPost();

    await expectSuccessfulTypedBackground<'api.v1.post-visible'>(worker, {
      post: { ...post, private: true },
    });

    expect(triggerTypedEvent).not.toHaveBeenCalled();
  });
});
