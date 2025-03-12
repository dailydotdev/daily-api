import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { saveFixtures } from '../helpers';
import {
  Source,
  Post,
  SourceType,
  PostType,
  User,
  Comment,
} from '../../src/entity';
import { UserTransaction } from '../../src/entity/user/UserTransaction';
import { usersFixture } from '../fixture';
import { UserComment } from '../../src/entity/user/UserComment';
import { TransferStatus } from '@dailydotdev/schema';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
});

describe('trigger user_comment_award_insert_trigger', () => {
  beforeEach(async () => {
    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `ucait-${item.id}`,
          username: `ucait-${item.username}`,
        };
      }),
    );
    const source = await con.getRepository(Source).save({
      id: 'a-ucait',
      name: 'A',
      image: 'http://image.com/a',
      handle: 'a-ucait',
      type: SourceType.Machine,
    });
    await con.getRepository(Post).save({
      id: 'p-ucait-1',
      shortId: 'sp-ucait-1',
      title: 'P1',
      url: 'http://p-ucait-1.com',
      canonicalUrl: 'http://p-ucait-1-c.com',
      image: 'https://daily.dev/image.jpg',
      score: 1,
      sourceId: source.id,
      createdAt: new Date(),
      tagsStr: 'javascript,webdev',
      type: PostType.Article,
      contentCuration: ['c1', 'c2'],
      awards: 0,
    });
  });

  it('should update comment awards on award added', async () => {
    const comment = await con.getRepository(Comment).save({
      id: 'c-ucait-1',
      postId: 'p-ucait-1',
      userId: 'ucait-1',
      content: 'C1',
    });

    expect(comment.awards).toBe(0);

    const transaction = await con.getRepository(UserTransaction).save({
      receiverId: 'ucait-1',
      status: TransferStatus.SUCCESS,
      productId: null,
      senderId: 'ucait-2',
      fee: 0,
      value: 100,
    });

    await con.getRepository(UserComment).save({
      commentId: comment.id,
      userId: 'ucait-1',
      awardTransactionId: transaction.id,
    });

    const commentAfter = await con
      .getRepository(Comment)
      .findOneByOrFail({ id: comment.id });

    expect(commentAfter.awards).toBe(1);
  });
});

describe('trigger user_comment_award_delete_trigger_function', () => {
  beforeEach(async () => {
    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `ucadt-${item.id}`,
          username: `ucadt-${item.username}`,
        };
      }),
    );
    const source = await con.getRepository(Source).save({
      id: 'a-ucadt',
      name: 'A',
      image: 'http://image.com/a',
      handle: 'a-ucadt',
      type: SourceType.Machine,
    });
    await con.getRepository(Post).save({
      id: 'p-ucadt-1',
      shortId: 'sp-ucadt-1',
      title: 'P1',
      url: 'http://p-ucadt-1.com',
      canonicalUrl: 'http://p-ucadt-1-c.com',
      image: 'https://daily.dev/image.jpg',
      score: 1,
      sourceId: source.id,
      createdAt: new Date(),
      tagsStr: 'javascript,webdev',
      type: PostType.Article,
      contentCuration: ['c1', 'c2'],
      awards: 0,
    });

    const comment = await con.getRepository(Comment).save({
      id: 'c-ucadt-1',
      postId: 'p-ucadt-1',
      userId: 'ucadt-1',
      content: 'C1',
    });

    const transaction = await con.getRepository(UserTransaction).save({
      receiverId: 'ucadt-1',
      status: TransferStatus.SUCCESS,
      productId: null,
      senderId: 'ucadt-2',
      fee: 0,
      value: 100,
    });

    await con.getRepository(UserComment).save({
      commentId: comment.id,
      userId: 'ucadt-1',
      awardTransactionId: transaction.id,
    });
  });

  it('should update comment awards on award removed', async () => {
    const comment = await con
      .getRepository(Comment)
      .save({ id: 'c-ucadt-1', awards: 5 });

    expect(comment.awards).toBe(5);

    await con.getRepository(UserComment).save({
      commentId: comment.id,
      userId: 'ucadt-1',
      awardTransactionId: null,
    });

    const commentAfter = await con
      .getRepository(Comment)
      .findOneByOrFail({ id: comment.id });

    expect(commentAfter.awards).toBe(4);
  });
});

describe('trigger user_comment_award_update_trigger_function', () => {
  beforeEach(async () => {
    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `ucaut-${item.id}`,
          username: `ucaut-${item.username}`,
        };
      }),
    );

    const source = await con.getRepository(Source).save({
      id: 'a-ucaut',
      name: 'A',
      image: 'http://image.com/a',
      handle: 'a-ucaut',
      type: SourceType.Machine,
    });
    await con.getRepository(Post).save({
      id: 'p-ucaut-1',
      shortId: 'sp-ucaut-1',
      title: 'P1',
      url: 'http://p-ucaut-1.com',
      canonicalUrl: 'http://p-ucaut-1-c.com',
      image: 'https://daily.dev/image.jpg',
      score: 1,
      sourceId: source.id,
      createdAt: new Date(),
      tagsStr: 'javascript,webdev',
      type: PostType.Article,
      contentCuration: ['c1', 'c2'],
      awards: 0,
    });

    const comment = await con.getRepository(Comment).save({
      id: 'c-ucaut-1',
      postId: 'p-ucaut-1',
      userId: 'ucaut-1',
      content: 'C1',
    });

    await con.getRepository(UserComment).save({
      commentId: comment.id,
      userId: 'ucaut-1',
    });
  });

  it('should update comment awards on award added', async () => {
    const comment = await con
      .getRepository(Comment)
      .save({ id: 'c-ucaut-1', awards: 5 });

    expect(comment.awards).toBe(5);

    const transaction = await con.getRepository(UserTransaction).save({
      receiverId: 'ucaut-1',
      status: TransferStatus.SUCCESS,
      productId: null,
      senderId: 'ucaut-2',
      fee: 0,
      value: 100,
    });

    const userComment = await con.getRepository(UserComment).findOneByOrFail({
      commentId: comment.id,
      userId: 'ucaut-1',
    });

    expect(userComment.awardTransactionId).toBe(null);

    await con.getRepository(UserComment).save({
      commentId: comment.id,
      userId: 'ucaut-1',
      awardTransactionId: transaction.id,
    });

    const commentAfter = await con
      .getRepository(Comment)
      .findOneByOrFail({ id: comment.id });

    expect(commentAfter.awards).toBe(6);
  });

  it('should update comment awards on award removed', async () => {
    const transaction = await con.getRepository(UserTransaction).save({
      receiverId: 'ucaut-1',
      status: TransferStatus.SUCCESS,
      productId: null,
      senderId: 'ucaut-2',
      fee: 0,
      value: 100,
    });

    const userComment = await con.getRepository(UserComment).save({
      commentId: 'c-ucaut-1',
      userId: 'ucaut-1',
      awardTransactionId: transaction.id,
    });

    expect(userComment.awardTransactionId).toBe(transaction.id);

    const comment = await con
      .getRepository(Comment)
      .save({ id: 'c-ucaut-1', awards: 5 });

    expect(comment.awards).toBe(5);

    await con.getRepository(UserComment).save({
      commentId: comment.id,
      userId: 'ucaut-1',
      awardTransactionId: null,
    });

    const commentAfter = await con
      .getRepository(Comment)
      .findOneByOrFail({ id: comment.id });

    expect(commentAfter.awards).toBe(4);
  });
});
