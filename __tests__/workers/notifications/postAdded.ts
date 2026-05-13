import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import {
  Comment,
  NotificationPreferenceSource,
  Post,
  Source,
  SourceMember,
  SourceType,
  SquadSource,
  User,
} from '../../../src/entity';
import { postAdded } from '../../../src/workers/notifications/postAdded';
import { badUsersFixture, sourcesFixture, usersFixture } from '../../fixture';
import { postsFixture } from '../../fixture/post';
import { workers } from '../../../src/workers/notifications';
import { invokeTypedNotificationWorker, saveFixtures } from '../../helpers';
import { SourceMemberRoles } from '../../../src/roles';
import {
  NotificationPreferenceStatus,
  NotificationType,
} from '../../../src/notifications/common';
import { randomUUID } from 'crypto';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, User, usersFixture);
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
      flags: { vordr: false },
    },
    {
      id: 'c2',
      postId: 'p1',
      userId: 'vordr',
      content: 'comment',
      contentHtml: '<p>comment</p>',
      flags: { vordr: true },
    },
  ]);
});

describe('vordrPostCommentPrevented', () => {
  it('should be registered', () => {
    const registeredWorker = workers.find(
      (item) => item.subscription === postAdded.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  describe('vordr', () => {
    it('should not send notification when the comment is prevented by vordr', async () => {
      await con
        .getRepository(Post)
        .update('p1', { authorId: '1', flags: { vordr: true } });

      const result = await invokeTypedNotificationWorker<'api.v1.post-visible'>(
        postAdded,
        {
          post: {
            id: 'p1',
          },
        },
      );

      expect(result).toBeUndefined();
    });

    it('should send notification when the comment is not prevented by vordr', async () => {
      await con
        .getRepository(Post)
        .update('p1', { authorId: '1', flags: { vordr: false } });

      const result = await invokeTypedNotificationWorker<'api.v1.post-visible'>(
        postAdded,
        {
          post: {
            id: 'p1',
          },
        },
      );

      expect(result?.length).toEqual(1);
    });
  });

  describe('linked sources', () => {
    beforeEach(async () => {
      await con
        .getRepository(Post)
        .update('p1', { authorId: null, private: false });
      await con
        .getRepository(Source)
        .update({ id: 'b' }, { type: SourceType.Squad });
      await con
        .getRepository(SquadSource)
        .update({ id: 'b' }, { linkedSourceIds: ['a'] });
      await con.getRepository(SourceMember).save([
        {
          userId: '2',
          sourceId: 'b',
          role: SourceMemberRoles.Member,
          referralToken: randomUUID(),
          createdAt: new Date(),
        },
        {
          userId: '3',
          sourceId: 'b',
          role: SourceMemberRoles.Member,
          referralToken: randomUUID(),
          createdAt: new Date(),
        },
      ]);
      await con.getRepository(NotificationPreferenceSource).save([
        {
          userId: '2',
          sourceId: 'b',
          referenceId: 'b',
          notificationType: NotificationType.SourcePostAdded,
          status: NotificationPreferenceStatus.Subscribed,
        },
      ]);
    });

    it('should emit SourcePostAdded for opt-in members of squads linked to the post source', async () => {
      const result = await invokeTypedNotificationWorker<'api.v1.post-visible'>(
        postAdded,
        {
          post: { id: 'p1' },
        },
      );

      const squadNotif = result?.find(
        (n) =>
          n.type === NotificationType.SourcePostAdded &&
          (n.ctx.source as Source).id === 'b',
      );
      expect(squadNotif).toBeDefined();
      expect(squadNotif?.ctx.userIds).toEqual(['2']);
    });

    it('should not emit when no squad has the source in linkedSourceIds', async () => {
      await con
        .getRepository(SquadSource)
        .update({ id: 'b' }, { linkedSourceIds: [] });

      const result = await invokeTypedNotificationWorker<'api.v1.post-visible'>(
        postAdded,
        {
          post: { id: 'p1' },
        },
      );

      const squadNotif = result?.find(
        (n) =>
          n.type === NotificationType.SourcePostAdded &&
          (n.ctx.source as Source).id === 'b',
      );
      expect(squadNotif).toBeUndefined();
    });

    it('should not notify blocked or unsubscribed members', async () => {
      await con.getRepository(NotificationPreferenceSource).save([
        {
          userId: '3',
          sourceId: 'b',
          referenceId: 'b',
          notificationType: NotificationType.SourcePostAdded,
          status: NotificationPreferenceStatus.Subscribed,
        },
      ]);
      await con
        .getRepository(SourceMember)
        .update(
          { userId: '3', sourceId: 'b' },
          { role: SourceMemberRoles.Blocked },
        );

      const result = await invokeTypedNotificationWorker<'api.v1.post-visible'>(
        postAdded,
        {
          post: { id: 'p1' },
        },
      );

      const squadNotif = result?.find(
        (n) =>
          n.type === NotificationType.SourcePostAdded &&
          (n.ctx.source as Source).id === 'b',
      );
      expect(squadNotif?.ctx.userIds).toEqual(['2']);
    });

    it('should fire even when the post has no authorId', async () => {
      const result = await invokeTypedNotificationWorker<'api.v1.post-visible'>(
        postAdded,
        {
          post: { id: 'p1' },
        },
      );

      const squadNotif = result?.find(
        (n) =>
          n.type === NotificationType.SourcePostAdded &&
          (n.ctx.source as Source).id === 'b',
      );
      expect(squadNotif).toBeDefined();
    });

    it('should not emit when the post is private', async () => {
      await con.getRepository(Post).update('p1', { private: true });

      const result = await invokeTypedNotificationWorker<'api.v1.post-visible'>(
        postAdded,
        {
          post: { id: 'p1' },
        },
      );

      const squadNotif = result?.find(
        (n) =>
          n.type === NotificationType.SourcePostAdded &&
          (n.ctx.source as Source).id === 'b',
      );
      expect(squadNotif).toBeUndefined();
    });
  });
});
