import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { Comment, Post, Source, User } from '../../src/entity';
import { badUsersFixture, sourcesFixture, usersFixture } from '../fixture';
import {
  checkWithVordr,
  VordrFilterType,
  validatePostTitle,
} from '../../src/common/vordr';
import { postsFixture } from '../fixture/post';
import { saveFixtures } from '../helpers';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(
    con,
    User,
    usersFixture.map((u) => ({ ...u, reputation: 10 })),
  );
  await saveFixtures(con, User, badUsersFixture);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
  await saveFixtures(con, Comment, [
    {
      id: 'c1',
      postId: 'p1',
      userId: '1',
      content: 'comment',
      contentHtml: '<p>comment</p>',
      flags: { vordr: true },
    },
    {
      id: 'c2',
      postId: 'p1',
      userId: '1',
      content: 'VordrWillCatchYou',
      contentHtml: '<p>comment</p>',
      flags: { vordr: true },
    },
  ]);
});

describe('commmon/vordr', () => {
  describe('validatePostTitle', () => {
    it('should return false for normal titles without emoji', () => {
      expect(validatePostTitle('This is a normal title')).toBeFalsy();
      expect(validatePostTitle('Another regular title here')).toBeFalsy();
      expect(validatePostTitle('123 Numbers in title')).toBeFalsy();
    });

    it('should return true for titles containing emoji', () => {
      expect(validatePostTitle('Title with emoji 😀')).toBeTruthy();
      expect(validatePostTitle('🚀 Starting with emoji')).toBeTruthy();
      expect(validatePostTitle('Middle 🎉 emoji')).toBeTruthy();
      expect(validatePostTitle('Ending with emoji 💯')).toBeTruthy();
      expect(validatePostTitle('Multiple 😀 emojis 🚀')).toBeTruthy();
    });

    it('should return false for undefined or empty titles', () => {
      expect(validatePostTitle(undefined)).toBeFalsy();
      expect(validatePostTitle('')).toBeFalsy();
    });

    it('should return true for titles with vordr words when configured', () => {
      expect(validatePostTitle('This title contains spam')).toBeTruthy();
      expect(validatePostTitle('SPAM in uppercase')).toBeTruthy();
      expect(validatePostTitle('This is banned content')).toBeTruthy();
      expect(validatePostTitle('Clean title without bad words')).toBeFalsy();
    });
  });

  describe('checkWithVordr', () => {
    it('should return true if user has vordr flag set', async () => {
      const comment = await con
        .getRepository(Comment)
        .findOneByOrFail({ id: 'c1' });

      const result = await checkWithVordr(
        {
          id: comment.id,
          type: VordrFilterType.Comment,
          content: comment.content,
        },
        {
          req: { ip: '127.0.0.1' },
          userId: 'vordr',
          con,
        },
      );

      expect(result).toBeTruthy();
    });

    it('should return true if user has trust score 0', async () => {
      const comment = await con
        .getRepository(Comment)
        .findOneByOrFail({ id: 'c1' });

      const result = await checkWithVordr(
        {
          id: comment.id,
          type: VordrFilterType.Comment,
          content: comment.content,
        },
        {
          req: { ip: '127.0.0.1' },
          userId: 'low-score',
          con,
        },
      );

      expect(result).toBeTruthy();
    });

    it('should return true if the IP of the request is in the Vordr subnet', async () => {
      const comment = await con
        .getRepository(Comment)
        .findOneByOrFail({ id: 'c1' });

      const result = await checkWithVordr(
        {
          id: comment.id,
          type: VordrFilterType.Comment,
          content: comment.content,
        },
        {
          req: { ip: '192.0.2.1' },
          userId: '1',
          con,
        },
      );

      expect(result).toBeTruthy();
    });

    it('should return true if the comment contains a word on Vordr word list', async () => {
      const comment = await con
        .getRepository(Comment)
        .findOneByOrFail({ id: 'c2' });

      const result = await checkWithVordr(
        {
          id: comment.id,
          type: VordrFilterType.Comment,
          content: comment.content,
        },
        {
          req: { ip: '127.0.0.1' },
          userId: '1',
          con,
        },
      );

      expect(result).toBeTruthy();
    });

    it('should return true if the user has low reputation', async () => {
      const comment = await con
        .getRepository(Comment)
        .findOneByOrFail({ id: 'c1' });

      const result = await checkWithVordr(
        {
          id: comment.id,
          type: VordrFilterType.Comment,
          content: comment.content,
        },
        {
          req: { ip: '127.0.0.1' },
          userId: 'low-reputation',
          con,
        },
      );

      expect(result).toBeTruthy();
    });

    it('should return true if the user has high reputation', async () => {
      const comment = await con
        .getRepository(Comment)
        .findOneByOrFail({ id: 'c1' });

      const result = await checkWithVordr(
        {
          id: comment.id,
          type: VordrFilterType.Comment,
          content: comment.content,
        },
        {
          req: { ip: '127.0.0.1' },
          userId: '1',
          con,
        },
      );

      expect(result).toBeFalsy();
    });

    it('should return false if it passes all Vordr filters', async () => {
      const comment = await con
        .getRepository(Comment)
        .findOneByOrFail({ id: 'c1' });

      const result = await checkWithVordr(
        {
          id: comment.id,
          type: VordrFilterType.Comment,
          content: comment.content,
        },
        {
          req: { ip: '127.0.0.1' },
          userId: '1',
          con,
        },
      );

      expect(result).toBeFalsy();
    });

    it('should return true for posts with emoji in title', async () => {
      const post = await con.getRepository(Post).findOneByOrFail({ id: 'p1' });

      const result = await checkWithVordr(
        {
          id: post.id,
          type: VordrFilterType.Post,
          content: 'Regular content',
          title: 'Title with emoji 🚀',
        },
        {
          req: { ip: '127.0.0.1' },
          userId: '1',
          con,
        },
      );

      expect(result).toBeTruthy();
    });

    it('should return false for posts with clean title', async () => {
      const post = await con.getRepository(Post).findOneByOrFail({ id: 'p1' });

      const result = await checkWithVordr(
        {
          id: post.id,
          type: VordrFilterType.Post,
          content: 'Regular content',
          title: 'Clean title without issues',
        },
        {
          req: { ip: '127.0.0.1' },
          userId: '1',
          con,
        },
      );

      expect(result).toBeFalsy();
    });

    it('should check title even when content is clean', async () => {
      const post = await con.getRepository(Post).findOneByOrFail({ id: 'p1' });

      const result = await checkWithVordr(
        {
          id: post.id,
          type: VordrFilterType.Post,
          content: 'Perfectly clean content here',
          title: 'Bad title with 😀 emoji',
        },
        {
          req: { ip: '127.0.0.1' },
          userId: '1',
          con,
        },
      );

      expect(result).toBeTruthy();
    });
  });
});
