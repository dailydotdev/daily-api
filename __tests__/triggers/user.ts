import { DataSource, JsonContains } from 'typeorm';
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
          authorId: '1',
          flags: { vordr: false },
        },
        {
          ...postsFixture[1],
          id: 'pvr2',
          shortId: 'pvr2',
          url: 'http://pvr2.com',
          canonicalUrl: 'http://pvr2c.com',
          authorId: '1',
          flags: { vordr: false },
        },
        {
          ...postsFixture[2],
          id: 'pvr3',
          shortId: 'pvr3',
          url: 'http://pvr3.com',
          canonicalUrl: 'http://pvr3c.com',
          authorId: '1',
          banned: true,
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

    describe('on comments', () => {
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

    describe('on posts', () => {
      it('should update all posts the user has made when the vordr flag is set to true', async () => {
        expect(
          await con.getRepository(ArticlePost).findBy({
            authorId: '1',
            flags: JsonContains({ vordr: true }),
          }),
        ).toHaveLength(0);

        await con
          .getRepository(User)
          .update({ id: '1' }, { flags: { vordr: true } });

        const posts = await con
          .getRepository(ArticlePost)
          .findBy({ authorId: '1', flags: JsonContains({ vordr: true }) });

        expect(posts.length).toBe(2);
        posts.forEach((post) => {
          expect(post.banned).toEqual(true);
          expect(post.flags.vordr).toEqual(true);
        });
      });

      it('should not update banned posts the user has made when the vordr flag is set to true', async () => {
        const existingPost = await con
          .getRepository(ArticlePost)
          .findOneByOrFail({
            id: 'pvr3',
          });

        expect(existingPost.banned).toEqual(true);
        expect(existingPost.flags.vordr).toBeFalsy();

        await con
          .getRepository(User)
          .update({ id: '1' }, { flags: { vordr: true } });

        const post = await con.getRepository(ArticlePost).findOneByOrFail({
          id: 'pvr3',
        });

        expect(post.banned).toEqual(true);
        expect(post.flags.vordr).toBeFalsy();
      });

      it('should update all posts the user has made when the vordr flag is set to false', async () => {
        await con.getRepository(ArticlePost).update(['pvr1', 'pvr2'], {
          banned: true,
          flags: { vordr: true },
        });

        expect(
          await con.getRepository(ArticlePost).findBy({
            authorId: '1',
          }),
        ).toHaveLength(3);

        await con
          .getRepository(User)
          .update({ id: '1' }, { flags: { vordr: false } });

        const posts = await con
          .getRepository(ArticlePost)
          .findBy({ authorId: '1', flags: JsonContains({ vordr: false }) });

        expect(posts.length).toBe(2);
        posts.forEach((post) => {
          expect(post.banned).toEqual(false);
          expect(post.flags.vordr).toEqual(false);
        });

        // Check that banned but not vordr posts are not updated
        expect(
          await con
            .getRepository(ArticlePost)
            .findBy({ id: 'pvr3', banned: true }),
        ).toHaveLength(1);
      });

      it('should not update banned posts the user has made when the vordr flag is set to false', async () => {
        await con
          .getRepository(ArticlePost)
          .update({ id: 'pvr3' }, { authorId: 'vordr' });

        await con
          .getRepository(ArticlePost)
          .update(
            { id: 'pvr2' },
            { authorId: 'vordr', banned: true, flags: { vordr: true } },
          );

        expect(
          (
            await con.getRepository(ArticlePost).findOneByOrFail({
              id: 'pvr2',
            })
          ).banned,
        ).toEqual(true);

        expect(
          (
            await con.getRepository(ArticlePost).findOneByOrFail({
              id: 'pvr3',
            })
          ).banned,
        ).toEqual(true);

        await con
          .getRepository(User)
          .update({ id: 'vordr' }, { flags: { vordr: false } });

        expect(
          (
            await con.getRepository(ArticlePost).findOneByOrFail({
              id: 'pvr2',
            })
          ).banned,
        ).toEqual(false);

        expect(
          (
            await con.getRepository(ArticlePost).findOneByOrFail({
              id: 'pvr3',
            })
          ).banned,
        ).toEqual(true);
      });
    });
  });
});
