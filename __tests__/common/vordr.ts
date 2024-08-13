import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { Comment, Post, Source, User } from '../../src/entity';
import { badUsersFixture, sourcesFixture, usersFixture } from '../fixture';
import { checkWithVordr, VordrFilterType } from '../../src/common/vordr';
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
  });
});
