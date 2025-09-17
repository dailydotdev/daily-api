import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { saveFixtures } from '../helpers';
import {
  ArticlePost,
  Source,
  SharePost,
  Post,
  SourceType,
  PostType,
  UserPost,
  User,
} from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
} from '../../src/entity/user/UserTransaction';
import { usersFixture } from '../fixture';
import { PollPost } from '../../src/entity/posts/PollPost';
import { PollOption } from '../../src/entity/polls/PollOption';
import { addDays } from 'date-fns';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
});

it('should set tags str of shared post on insert and update', async () => {
  await con.getRepository(SharePost).insert({
    id: 'sp',
    shortId: 'sp',
    title: 'T',
    sharedPostId: 'p1',
    sourceId: postsFixture[0].sourceId,
  });
  const obj = await con.getRepository(Post).findOneBy({ id: 'sp' });
  expect(obj.tagsStr).toEqual(postsFixture[0].tagsStr);
  await con.getRepository(ArticlePost).update({ id: 'p1' }, { tagsStr: 'a,b' });
  // Make sure only sp gets affected
  const obj2 = await con
    .getRepository(Post)
    .find({ where: { tagsStr: 'a,b' }, order: { id: 'ASC' }, select: ['id'] });
  expect(obj2.map((x) => x.id)).toEqual(['p1', 'sp']);
});

it('should set tags str of shared post on update when original post had no tags', async () => {
  await con.getRepository(SharePost).insert({
    id: 'sp',
    shortId: 'sp',
    title: 'T',
    sharedPostId: 'p2',
    sourceId: postsFixture[0].sourceId,
  });
  const obj = await con.getRepository(Post).findOneBy({ id: 'sp' });
  expect(obj.tagsStr).toBeFalsy();
  await con.getRepository(ArticlePost).update({ id: 'p2' }, { tagsStr: 'a,b' });
  // Make sure only sp gets affected
  const obj2 = await con
    .getRepository(Post)
    .find({ where: { tagsStr: 'a,b' }, order: { id: 'ASC' }, select: ['id'] });
  expect(obj2.map((x) => x.id)).toEqual(['p2', 'sp']);
});

describe('trigger increment_source_views_count', () => {
  it('should update source total views', async () => {
    const repo = con.getRepository(Source);
    const source = await repo.findOneByOrFail({ id: 'a' });
    expect(source.flags.totalViews).toEqual(undefined);

    await con.getRepository(Post).update({ id: 'p1' }, { views: 1 });

    const updatedSource = await repo.findOneByOrFail({ id: 'a' });
    expect(updatedSource.flags.totalViews).toEqual(1);
  });

  it('should not update source total views when post is deleted', async () => {
    const repo = con.getRepository(Source);
    const source = await repo.findOneByOrFail({ id: 'a' });
    expect(source.flags.totalViews).toEqual(undefined);

    await con
      .getRepository(Post)
      .update({ id: 'p1' }, { views: 1, deleted: true });

    const updatedSource = await repo.findOneByOrFail({ id: 'a' });
    expect(updatedSource.flags.totalViews).toEqual(0);
  });

  it('should update squad total views', async () => {
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });
    const source = await repo.findOneByOrFail({ id: 'a' });
    expect(source.flags.totalViews).toEqual(undefined);

    await con.getRepository(Post).update({ id: 'p1' }, { views: 1 });

    const updatedSource = await repo.findOneByOrFail({ id: 'a' });
    expect(updatedSource.flags.totalViews).toEqual(1);
  });
});

describe('trigger post_stats_updated_at_update_trigger', () => {
  it('should update statsUpdatedAt when upvotes change', async () => {
    const repo = con.getRepository(Post);
    const beforePost = await repo.findOneByOrFail({ id: 'p1' });
    expect(beforePost.upvotes).toEqual(0);
    await repo.update({ id: 'p1' }, { upvotes: 15 });
    const afterPost = await repo.findOneByOrFail({ id: 'p1' });
    expect(afterPost.statsUpdatedAt.getTime()).toBeGreaterThan(
      beforePost.statsUpdatedAt.getTime(),
    );
  });

  it('should update statsUpdatedAt when downvotes change', async () => {
    const repo = con.getRepository(Post);
    const beforePost = await repo.findOneByOrFail({ id: 'p1' });
    expect(beforePost.downvotes).toEqual(0);
    await repo.update({ id: 'p1' }, { downvotes: 15 });
    const afterPost = await repo.findOneByOrFail({ id: 'p1' });
    expect(afterPost.statsUpdatedAt.getTime()).toBeGreaterThan(
      beforePost.statsUpdatedAt.getTime(),
    );
  });

  it('should update statsUpdatedAt when comments change', async () => {
    const repo = con.getRepository(Post);
    const beforePost = await repo.findOneByOrFail({ id: 'p1' });
    expect(beforePost.comments).toEqual(0);
    await repo.update({ id: 'p1' }, { comments: 15 });
    const afterPost = await repo.findOneByOrFail({ id: 'p1' });
    expect(afterPost.statsUpdatedAt.getTime()).toBeGreaterThan(
      beforePost.statsUpdatedAt.getTime(),
    );
  });

  it('should update statsUpdatedAt when multiple columns change', async () => {
    const repo = con.getRepository(Post);
    const beforePost = await repo.findOneByOrFail({ id: 'p1' });
    expect(beforePost.upvotes).toEqual(0);
    expect(beforePost.downvotes).toEqual(0);
    expect(beforePost.comments).toEqual(0);
    await repo.update(
      { id: 'p1' },
      { upvotes: 15, downvotes: 35, comments: 25 },
    );
    const afterPost = await repo.findOneByOrFail({ id: 'p1' });
    expect(afterPost.statsUpdatedAt.getTime()).toBeGreaterThan(
      beforePost.statsUpdatedAt.getTime(),
    );
  });

  it("should not update statsUpdatedAt when columns don't change", async () => {
    const repo = con.getRepository(Post);
    await repo.update(
      { id: 'p1' },
      { upvotes: 15, downvotes: 35, comments: 25 },
    );
    const beforePost = await repo.findOneByOrFail({ id: 'p1' });
    await repo.update(
      { id: 'p1' },
      { title: 'new title', upvotes: 15, downvotes: 35, comments: 25 },
    );
    const afterPost = await repo.findOneByOrFail({ id: 'p1' });
    expect(afterPost.statsUpdatedAt.getTime()).toEqual(
      beforePost.statsUpdatedAt.getTime(),
    );
  });

  it('should not update statsUpdatedAt when other columns change', async () => {
    const repo = con.getRepository(Post);
    const beforePost = await repo.findOneByOrFail({ id: 'p1' });
    await repo.update({ id: 'p1' }, { title: 'new title' });
    const afterPost = await repo.findOneByOrFail({ id: 'p1' });
    expect(afterPost.statsUpdatedAt.getTime()).toEqual(
      beforePost.statsUpdatedAt.getTime(),
    );
  });
});

describe('trigger update_source_stats_on_delete', () => {
  it('should update source stats when post is deleted', async () => {
    const repo = con.getRepository(Source);
    await con
      .getRepository(Post)
      .update({ id: 'p1' }, { views: 100, upvotes: 5 });

    const source = await repo.findOneByOrFail({ id: 'a' });
    expect(source.flags.totalViews).toEqual(100);
    expect(source.flags.totalUpvotes).toEqual(5);
    expect(source.flags.totalPosts).toEqual(2);

    await con.getRepository(Post).update({ id: 'p1' }, { deleted: true });

    const updatedSource = await repo.findOneByOrFail({ id: 'a' });
    expect(updatedSource.flags.totalViews).toEqual(0);
    expect(updatedSource.flags.totalUpvotes).toEqual(0);
    expect(updatedSource.flags.totalPosts).toEqual(1);
  });

  it('should not do anything if deleted was not updated', async () => {
    const repo = con.getRepository(Source);
    await con
      .getRepository(Post)
      .update({ id: 'p1' }, { views: 100, upvotes: 5 });

    const source = await repo.findOneByOrFail({ id: 'a' });
    expect(source.flags.totalViews).toEqual(100);
    expect(source.flags.totalUpvotes).toEqual(5);
    expect(source.flags.totalPosts).toEqual(2);

    await con.getRepository(Post).update({ id: 'p1' }, { title: 'hello' });

    const updatedSource = await repo.findOneByOrFail({ id: 'a' });
    expect(updatedSource.flags.totalViews).toEqual(100);
    expect(updatedSource.flags.totalUpvotes).toEqual(5);
    expect(updatedSource.flags.totalPosts).toEqual(2);
  });
});

describe('trigger user_post_award_insert_trigger', () => {
  beforeEach(async () => {
    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `upait-${item.id}`,
          username: `upait-${item.username}`,
        };
      }),
    );
  });

  it('should update post awards on award added', async () => {
    const source = await con.getRepository(Source).save({
      id: 'a-upait',
      name: 'A',
      image: 'http://image.com/a',
      handle: 'a-upait',
      type: SourceType.Machine,
    });
    const post = await con.getRepository(Post).save({
      id: 'p-upait-1',
      shortId: 'sp-upait-1',
      title: 'P1',
      url: 'http://p-upait-1.com',
      canonicalUrl: 'http://p-upait-1-c.com',
      image: 'https://daily.dev/image.jpg',
      score: 1,
      sourceId: source.id,
      createdAt: new Date(),
      tagsStr: 'javascript,webdev',
      type: PostType.Article,
      contentCuration: ['c1', 'c2'],
      awards: 0,
    });

    expect(post.awards).toBe(0);

    const transaction = await con.getRepository(UserTransaction).save({
      processor: UserTransactionProcessor.Njord,
      receiverId: 'upait-1',
      status: UserTransactionStatus.Success,
      productId: null,
      senderId: 'upait-2',
      fee: 0,
      value: 100,
      valueIncFees: 100,
    });

    await con.getRepository(UserPost).save({
      postId: post.id,
      userId: 'upait-1',
      awardTransactionId: transaction.id,
    });

    const postAfter = await con
      .getRepository(Post)
      .findOneByOrFail({ id: post.id });

    expect(postAfter.awards).toBe(1);
  });
});

describe('trigger user_post_award_delete_trigger_function', () => {
  beforeEach(async () => {
    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `upadt-${item.id}`,
          username: `upadt-${item.username}`,
        };
      }),
    );

    const source = await con.getRepository(Source).save({
      id: 'a-upadt',
      name: 'A',
      image: 'http://image.com/a',
      handle: 'a-upadt',
      type: SourceType.Machine,
    });
    const post = await con.getRepository(Post).save({
      id: 'p-upadt-1',
      shortId: 'sp-upadt-1',
      title: 'P1',
      url: 'http://p-upadt-1.com',
      canonicalUrl: 'http://p-upadt-1-c.com',
      image: 'https://daily.dev/image.jpg',
      score: 1,
      sourceId: source.id,
      createdAt: new Date(),
      tagsStr: 'javascript,webdev',
      type: PostType.Article,
      contentCuration: ['c1', 'c2'],
      awards: 0,
    });

    const transaction = await con.getRepository(UserTransaction).save({
      processor: UserTransactionProcessor.Njord,
      receiverId: 'upadt-1',
      status: UserTransactionStatus.Success,
      productId: null,
      senderId: 'upadt-2',
      fee: 0,
      value: 100,
      valueIncFees: 100,
    });

    await con.getRepository(UserPost).save({
      postId: post.id,
      userId: 'upadt-1',
      awardTransactionId: transaction.id,
    });
  });

  it('should update post awards on award removed', async () => {
    const post = await con
      .getRepository(Post)
      .save({ id: 'p-upadt-1', awards: 5 });

    expect(post.awards).toBe(5);

    await con.getRepository(UserPost).save({
      postId: post.id,
      userId: 'upadt-1',
      awardTransactionId: null,
    });

    const postAfter = await con
      .getRepository(Post)
      .findOneByOrFail({ id: post.id });

    expect(postAfter.awards).toBe(4);
  });
});

describe('trigger user_post_award_update_trigger_function', () => {
  beforeEach(async () => {
    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `upaut-${item.id}`,
          username: `upaut-${item.username}`,
        };
      }),
    );

    const source = await con.getRepository(Source).save({
      id: 'a-upaut',
      name: 'A',
      image: 'http://image.com/a',
      handle: 'a-upaut',
      type: SourceType.Machine,
    });
    const post = await con.getRepository(Post).save({
      id: 'p-upaut-1',
      shortId: 'sp-upaut-1',
      title: 'P1',
      url: 'http://p-upaut-1.com',
      canonicalUrl: 'http://p-upaut-1-c.com',
      image: 'https://daily.dev/image.jpg',
      score: 1,
      sourceId: source.id,
      createdAt: new Date(),
      tagsStr: 'javascript,webdev',
      type: PostType.Article,
      contentCuration: ['c1', 'c2'],
      awards: 0,
    });

    await con.getRepository(UserPost).save({
      postId: post.id,
      userId: 'upaut-1',
    });
  });

  it('should update post awards on award added', async () => {
    const post = await con
      .getRepository(Post)
      .save({ id: 'p-upaut-1', awards: 5 });

    expect(post.awards).toBe(5);

    const transaction = await con.getRepository(UserTransaction).save({
      processor: UserTransactionProcessor.Njord,
      receiverId: 'upaut-1',
      status: UserTransactionStatus.Success,
      productId: null,
      senderId: 'upaut-2',
      fee: 0,
      value: 100,
      valueIncFees: 100,
    });

    const userPost = await con.getRepository(UserPost).findOneByOrFail({
      postId: post.id,
      userId: 'upaut-1',
    });

    expect(userPost.awardTransactionId).toBe(null);

    await con.getRepository(UserPost).save({
      postId: post.id,
      userId: 'upaut-1',
      awardTransactionId: transaction.id,
    });

    const postAfter = await con
      .getRepository(Post)
      .findOneByOrFail({ id: post.id });

    expect(postAfter.awards).toBe(6);
  });

  it('should update post awards on award removed', async () => {
    const transaction = await con.getRepository(UserTransaction).save({
      processor: UserTransactionProcessor.Njord,
      receiverId: 'upaut-1',
      status: UserTransactionStatus.Success,
      productId: null,
      senderId: 'upaut-2',
      fee: 0,
      value: 100,
      valueIncFees: 100,
    });

    const userPost = await con.getRepository(UserPost).save({
      postId: 'p-upaut-1',
      userId: 'upaut-1',
      awardTransactionId: transaction.id,
    });

    expect(userPost.awardTransactionId).toBe(transaction.id);

    const post = await con
      .getRepository(Post)
      .save({ id: 'p-upaut-1', awards: 5 });

    expect(post.awards).toBe(5);

    await con.getRepository(UserPost).save({
      postId: post.id,
      userId: 'upaut-1',
      awardTransactionId: null,
    });

    const postAfter = await con
      .getRepository(Post)
      .findOneByOrFail({ id: post.id });

    expect(postAfter.awards).toBe(4);
  });
});

describe('trigger user_post_poll_vote_insert_trigger', () => {
  it('should increment poll option votes and post total votes on insert', async () => {
    const pollPost = await con.getRepository(PollPost).save({
      id: 'poll-test',
      shortId: 'poll-test',
      title: 'Test Poll',
      type: PostType.Poll,
      sourceId: 'a',
      endsAt: addDays(new Date(), 3),
      numPollVotes: 0,
    });

    const option = await con.getRepository(PollOption).save({
      text: 'Option 1',
      order: 1,
      postId: pollPost.id,
      numVotes: 0,
    });

    await con.getRepository(User).save({
      id: 'poll-user',
      name: 'Poll User',
      image: 'https://daily.dev/image.jpg',
    });

    await con.getRepository(UserPost).save({
      postId: pollPost.id,
      userId: 'poll-user',
      pollVoteOptionId: option.id,
    });

    const updatedOption = await con
      .getRepository(PollOption)
      .findOneByOrFail({ id: option.id });
    const updatedPost = await con
      .getRepository(PollPost)
      .findOneByOrFail({ id: pollPost.id });

    expect(updatedOption.numVotes).toBe(1);
    expect(updatedPost.numPollVotes).toBe(1);
  });
});

describe('trigger user_post_poll_vote_delete_trigger', () => {
  it('should decrement poll option votes and post total votes on delete', async () => {
    const pollPost = await con.getRepository(PollPost).save({
      id: 'poll-del',
      shortId: 'poll-del',
      title: 'Test Poll Delete',
      type: PostType.Poll,
      sourceId: 'a',
      endsAt: addDays(new Date(), 3),
      numPollVotes: 0,
    });

    const option = await con.getRepository(PollOption).save({
      text: 'Option 1',
      order: 1,
      postId: pollPost.id,
      numVotes: 0,
    });

    await con.getRepository(User).save({
      id: 'poll-user-del',
      name: 'Poll User Del',
      image: 'https://daily.dev/image.jpg',
    });

    await con.getRepository(UserPost).save({
      postId: pollPost.id,
      userId: 'poll-user-del',
      pollVoteOptionId: option.id,
    });

    await con.getRepository(User).delete({ id: 'poll-user-del' });

    const updatedOption = await con
      .getRepository(PollOption)
      .findOneByOrFail({ id: option.id });
    const updatedPost = await con
      .getRepository(PollPost)
      .findOneByOrFail({ id: pollPost.id });

    expect(updatedOption.numVotes).toBe(0);
    expect(updatedPost.numPollVotes).toBe(0);
  });
});

describe('trigger user_post_poll_vote_update_trigger', () => {
  it('should increment poll option votes and post total votes when pollVoteOptionId is added', async () => {
    const pollPost = await con.getRepository(PollPost).save({
      id: 'poll-upd',
      shortId: 'poll-upd',
      title: 'Test Poll Update',
      type: PostType.Poll,
      sourceId: 'a',
      endsAt: addDays(new Date(), 3),
      numPollVotes: 0,
    });

    const option = await con.getRepository(PollOption).save({
      text: 'Option 1',
      order: 1,
      postId: pollPost.id,
      numVotes: 0,
    });

    await con.getRepository(User).save({
      id: 'poll-user-upd',
      name: 'Poll User Update',
      image: 'https://daily.dev/image.jpg',
    });

    await con.getRepository(UserPost).save({
      postId: pollPost.id,
      userId: 'poll-user-upd',
    });

    await con
      .getRepository(UserPost)
      .update(
        { postId: pollPost.id, userId: 'poll-user-upd' },
        { pollVoteOptionId: option.id },
      );

    const updatedOption = await con
      .getRepository(PollOption)
      .findOneByOrFail({ id: option.id });
    const updatedPost = await con
      .getRepository(PollPost)
      .findOneByOrFail({ id: pollPost.id });

    expect(updatedOption.numVotes).toBe(1);
    expect(updatedPost.numPollVotes).toBe(1);
  });

  it('should decrement poll option votes and post total votes when pollVoteOptionId is removed', async () => {
    const pollPost = await con.getRepository(PollPost).save({
      id: 'poll-upd-remove',
      shortId: 'poll-upd-rem',
      title: 'Test Poll Update Remove',
      type: PostType.Poll,
      sourceId: 'a',
      endsAt: addDays(new Date(), 3),
      numPollVotes: 0,
    });

    const option = await con.getRepository(PollOption).save({
      text: 'Option 1',
      order: 1,
      postId: pollPost.id,
      numVotes: 0,
    });

    await con.getRepository(User).save({
      id: 'poll-user-upd-remove',
      name: 'Poll User Update Remove',
      image: 'https://daily.dev/image.jpg',
    });

    await con.getRepository(UserPost).save({
      postId: pollPost.id,
      userId: 'poll-user-upd-remove',
    });

    await con
      .getRepository(UserPost)
      .update(
        { postId: pollPost.id, userId: 'poll-user-upd-remove' },
        { pollVoteOptionId: option.id },
      );
    await con
      .getRepository(UserPost)
      .update(
        { postId: pollPost.id, userId: 'poll-user-upd-remove' },
        { pollVoteOptionId: null },
      );

    const updatedOption = await con
      .getRepository(PollOption)
      .findOneByOrFail({ id: option.id });
    const updatedPost = await con
      .getRepository(PollPost)
      .findOneByOrFail({ id: pollPost.id });

    expect(updatedOption.numVotes).toBe(0);
    expect(updatedPost.numPollVotes).toBe(0);
  });

  it('should handle changing vote from one option to another', async () => {
    const pollPost = await con.getRepository(PollPost).save({
      id: 'poll-upd-change',
      shortId: 'poll-upd-chg',
      title: 'Test Poll Update Change',
      type: PostType.Poll,
      sourceId: 'a',
      endsAt: addDays(new Date(), 3),
      numPollVotes: 0,
    });

    const option1 = await con.getRepository(PollOption).save({
      text: 'Option 1',
      order: 1,
      postId: pollPost.id,
      numVotes: 0,
    });

    const option2 = await con.getRepository(PollOption).save({
      text: 'Option 2',
      order: 2,
      postId: pollPost.id,
      numVotes: 0,
    });

    await con.getRepository(User).save({
      id: 'poll-user-upd-change',
      name: 'Poll User Update Change',
      image: 'https://daily.dev/image.jpg',
    });

    await con.getRepository(UserPost).save({
      postId: pollPost.id,
      userId: 'poll-user-upd-change',
    });

    await con
      .getRepository(UserPost)
      .update(
        { postId: pollPost.id, userId: 'poll-user-upd-change' },
        { pollVoteOptionId: option1.id },
      );
    await con
      .getRepository(UserPost)
      .update(
        { postId: pollPost.id, userId: 'poll-user-upd-change' },
        { pollVoteOptionId: option2.id },
      );

    const updatedOption1 = await con
      .getRepository(PollOption)
      .findOneByOrFail({ id: option1.id });
    const updatedOption2 = await con
      .getRepository(PollOption)
      .findOneByOrFail({ id: option2.id });
    const updatedPost = await con
      .getRepository(PollPost)
      .findOneByOrFail({ id: pollPost.id });

    expect(updatedOption1.numVotes).toBe(0);
    expect(updatedOption2.numVotes).toBe(1);
    expect(updatedPost.numPollVotes).toBe(1);
  });
});
