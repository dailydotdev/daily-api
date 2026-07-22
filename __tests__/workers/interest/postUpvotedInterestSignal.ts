import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { expectSuccessfulTypedBackground, saveFixtures } from '../../helpers';
import { postUpvotedInterestSignalWorker as worker } from '../../../src/workers/interest/postUpvotedInterestSignal';
import { ArticlePost, Source, User } from '../../../src/entity';
import { Feed } from '../../../src/entity/Feed';
import { FeedTag } from '../../../src/entity/FeedTag';
import { PostKeyword } from '../../../src/entity/PostKeyword';
import { Keyword, KeywordStatus } from '../../../src/entity/Keyword';
import {
  UserInterest,
  UserInterestStatus,
} from '../../../src/entity/UserInterest';
import { usersFixture } from '../../fixture/user';
import { postsFixture } from '../../fixture/post';
import { sourcesFixture } from '../../fixture';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await saveFixtures(con, Keyword, [
    { value: 'zig', status: KeywordStatus.Allow, occurrences: 1 },
    { value: 'gamedev', status: KeywordStatus.Allow, occurrences: 1 },
  ]);
  await con.getRepository(PostKeyword).save([
    { postId: 'p1', keyword: 'zig', status: 'allow' },
    { postId: 'p1', keyword: 'gamedev', status: 'allow' },
  ]);
  await con.getRepository(Feed).save({ id: 'feed-1', userId: '1', flags: {} });
  await con.getRepository(FeedTag).save({ feedId: 'feed-1', tag: 'zig' });
  await con.getRepository(UserInterest).save({
    id: 'uir-1',
    userId: '1',
    query: 'cool zig projects',
    status: UserInterestStatus.Active,
    feedId: 'feed-1',
  });
});

describe('postUpvotedInterestSignal worker', () => {
  it('reinforces overlapping interest tags with the upvoted post keywords', async () => {
    await expectSuccessfulTypedBackground<'post-upvoted'>(worker, {
      postId: 'p1',
      userId: '1',
    });

    const tags = await con.getRepository(FeedTag).findBy({ feedId: 'feed-1' });
    const tagValues = tags.map((tag) => tag.tag);
    expect(tagValues).toContain('zig');
    expect(tagValues).toContain('gamedev');
  });

  it('does nothing when the user has no overlapping interest', async () => {
    await con.getRepository(FeedTag).delete({ feedId: 'feed-1', tag: 'zig' });
    await con.getRepository(FeedTag).save({ feedId: 'feed-1', tag: 'rust' });

    await expectSuccessfulTypedBackground<'post-upvoted'>(worker, {
      postId: 'p1',
      userId: '1',
    });

    const tags = await con.getRepository(FeedTag).findBy({ feedId: 'feed-1' });
    expect(tags.map((tag) => tag.tag)).not.toContain('gamedev');
  });
});
