import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { saveFixtures } from '../helpers';
import { badUsersFixture, usersFixture } from '../fixture/user';
import {
  Source,
  User,
  UserStreak,
  Comment,
  ArticlePost,
} from '../../src/entity';
import { sourcesFixture } from '../fixture';
import { postsFixture } from '../fixture/post';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
});

describe('user', () => {
  describe('creation', () => {
    it('should insert streak if not exists', async () => {
      const repo = con.getRepository(UserStreak);
      const exists = await repo.findOneBy({ userId: '1' });

      expect(exists).toBeFalsy();

      await saveFixtures(con, User, usersFixture);

      const user = await con.getRepository(User).findOneByOrFail({
        id: '1',
      });
      expect(user).toBeTruthy();

      const streak = await repo.findOneBy({ userId: user.id });
      expect(streak).toBeTruthy();
    });
  });

  describe('vordr flag', () => {
    beforeEach(async () => {
      await saveFixtures(con, User, usersFixture);
      await saveFixtures(con, User, badUsersFixture);
      await saveFixtures(con, Source, sourcesFixture);
      await saveFixtures(con, ArticlePost, [
        {
          ...postsFixture[0],
          id: 'pvr1',
          shortId: 'pvr1',
          url: 'http://pvr1.com',
          canonicalUrl: 'http://pvr1c.com',
        },
      ]);
      await saveFixtures(con, Comment, [
        {
          id: 'cvr1',
          postId: 'pvr1',
          userId: '1',
          content: 'comment',
          contentHtml: '<p>comment</p>',
          flags: { vordr: false },
        },
        {
          id: 'cvr2',
          parentId: 'cvr1',
          postId: 'pvr1',
          userId: '1',
          content: 'comment',
          contentHtml: '<p>comment</p>',
          flags: { vordr: false },
        },
        {
          id: 'cvr3',
          parentId: 'cvr1',
          postId: 'pvr1',
          userId: 'vordr',
          content: 'comment',
          contentHtml: '<p>comment</p>',
          flags: { vordr: true },
        },
        {
          id: 'cvr4',
          parentId: 'cvr1',
          postId: 'pvr1',
          userId: 'vordr',
          content: 'comment',
          contentHtml: '<p>comment</p>',
          flags: { vordr: true },
        },
      ]);
    });

    it('should update all comments the user has made when the vordr flag is set to true', async () => {
      expect(
        await con
          .getRepository(Comment)
          .findBy({ userId: '1', flags: { vordr: true } }),
      ).toHaveLength(0);

      await con
        .getRepository(User)
        .update({ id: '1' }, { flags: { vordr: true } });

      const comments = await con
        .getRepository(Comment)
        .findBy({ userId: '1', flags: { vordr: true } });

      expect(comments.length).toBe(2);
      comments.forEach((comment) => {
        expect(comment.flags.vordr).toEqual(true);
      });
    });

    it('should update all comments the user has made when the vordr flag is set to false', async () => {
      expect(
        await con
          .getRepository(Comment)
          .findBy({ userId: 'vordr', flags: { vordr: false } }),
      ).toHaveLength(0);

      await con
        .getRepository(User)
        .update({ id: 'vordr' }, { flags: { vordr: false } });

      const comments = await con
        .getRepository(Comment)
        .findBy({ userId: 'vordr', flags: { vordr: false } });

      expect(comments.length).toBe(2);
      comments.forEach((comment) => {
        expect(comment.flags.vordr).toEqual(false);
      });
    });
  });
});
