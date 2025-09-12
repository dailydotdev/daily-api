import { DataSource } from 'typeorm';
import worker from '../../../src/workers/notifications/sourcePostModerationSubmittedNotification';
import createOrGetConnection from '../../../src/db';
import { Source, SourceMember, SourceType, User } from '../../../src/entity';
import { sourcesFixture, usersFixture } from '../../fixture';
import { workers } from '../../../src/workers';
import { invokeTypedNotificationWorker, saveFixtures } from '../../helpers';
import { SourcePostModerationStatus } from '../../../src/entity/SourcePostModeration';
import { SourceMemberRoles } from '../../../src/roles';
import { NotificationPostModerationContext } from '../../../src/notifications';
import { NotificationPreferenceSource } from '../../../src/entity/notifications/NotificationPreferenceSource';
import {
  NotificationPreferenceStatus,
  NotificationType,
} from '../../../src/notifications/common';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, User, usersFixture);
});

describe('SourcePostModerationSubmitted', () => {
  it('should be registered', () => {
    const registeredWorker = workers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should not send notification when the status is not pending', async () => {
    const post = {
      sourceId: 'a',
      status: SourcePostModerationStatus.Approved,
    };

    const result = await invokeTypedNotificationWorker<'api.v1.source-post-moderation-submitted'>(worker, { post });

    expect(result).toBeUndefined();
  });

  it('should send notification to admins', async () => {
    const post = {
      sourceId: 'a',
      createdById: '2',
      status: SourcePostModerationStatus.Pending,
    };
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con.getRepository(SourceMember).save({
      sourceId: 'a',
      userId: '1',
      role: SourceMemberRoles.Admin,
      referralToken: 'a',
    });

    const result = await invokeTypedNotificationWorker<'api.v1.source-post-moderation-submitted'>(worker, { post });
    const ctx = result[0].ctx as NotificationPostModerationContext;

    expect(result.length).toEqual(1);
    expect(result[0].type).toEqual('source_post_submitted');
    expect(ctx.post).toEqual(post);
    expect(ctx.userIds).toEqual(['1']);
  });

  it('should send notification to moderators', async () => {
    const post = {
      sourceId: 'a',
      createdById: '2',
      status: SourcePostModerationStatus.Pending,
    };
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con.getRepository(SourceMember).save({
      sourceId: 'a',
      userId: '1',
      role: SourceMemberRoles.Moderator,
      referralToken: 'a',
    });

    const result = await invokeTypedNotificationWorker<'api.v1.source-post-moderation-submitted'>(worker, { post });
    const ctx = result[0].ctx as NotificationPostModerationContext;

    expect(result.length).toEqual(1);
    expect(result[0].type).toEqual('source_post_submitted');
    expect(ctx.post).toEqual(post);
    expect(ctx.userIds).toEqual(['1']);
  });

  it('should not send notification to members', async () => {
    const post = {
      sourceId: 'a',
      createdById: '2',
      status: SourcePostModerationStatus.Pending,
    };
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con.getRepository(SourceMember).save([
      {
        sourceId: 'a',
        userId: '1',
        role: SourceMemberRoles.Moderator,
        referralToken: 'a',
      },
      {
        sourceId: 'a',
        userId: '3',
        role: SourceMemberRoles.Member,
        referralToken: 'b',
      },
    ]);

    const result = await invokeTypedNotificationWorker<'api.v1.source-post-moderation-submitted'>(worker, { post });
    const ctx = result[0].ctx as NotificationPostModerationContext;

    expect(result.length).toEqual(1);
    expect(result[0].type).toEqual('source_post_submitted');
    expect(ctx.post).toEqual(post);
    expect(ctx.userIds).toEqual(['1']);
    const noMembers = ctx.userIds.every((id) => id !== '3');
    expect(noMembers).toBeTruthy();
  });

  it('should not send notification to blocked members', async () => {
    const post = {
      sourceId: 'a',
      createdById: '2',
      status: SourcePostModerationStatus.Pending,
    };
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con.getRepository(SourceMember).save([
      {
        sourceId: 'a',
        userId: '1',
        role: SourceMemberRoles.Moderator,
        referralToken: 'a',
      },
      {
        sourceId: 'a',
        userId: '3',
        role: SourceMemberRoles.Blocked,
        referralToken: 'b',
      },
    ]);

    const result = await invokeTypedNotificationWorker<'api.v1.source-post-moderation-submitted'>(worker, { post });
    const ctx = result[0].ctx as NotificationPostModerationContext;

    expect(result.length).toEqual(1);
    expect(result[0].type).toEqual('source_post_submitted');
    expect(ctx.post).toEqual(post);
    expect(ctx.userIds).toEqual(['1']);
    const noMembers = ctx.userIds.every((id) => id !== '3');
    expect(noMembers).toBeTruthy();
  });

  it('should not send notification to post author', async () => {
    const post = {
      sourceId: 'a',
      createdById: '2',
      status: SourcePostModerationStatus.Pending,
    };
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con.getRepository(SourceMember).save([
      {
        sourceId: 'a',
        userId: '1',
        role: SourceMemberRoles.Moderator,
        referralToken: 'a',
      },
      {
        sourceId: 'a',
        userId: '3',
        role: SourceMemberRoles.Blocked,
        referralToken: 'b',
      },
    ]);

    const result = await invokeTypedNotificationWorker<'api.v1.source-post-moderation-submitted'>(worker, { post });
    const ctx = result[0].ctx as NotificationPostModerationContext;

    expect(result.length).toEqual(1);
    expect(result[0].type).toEqual('source_post_submitted');
    expect(ctx.post).toEqual(post);
    expect(ctx.userIds).toEqual(['1']);
    const noAuthor = ctx.userIds.every((id) => id !== '2');
    expect(noAuthor).toBeTruthy();
  });

  describe('content preference filtering', () => {
    it('should send notifications to users with no content preferences', async () => {
      const post = {
        sourceId: 'a',
        createdById: '2',
        status: SourcePostModerationStatus.Pending,
      };
      await con
        .getRepository(Source)
        .update({ id: 'a' }, { type: SourceType.Squad });
      await con.getRepository(SourceMember).save([
        {
          sourceId: 'a',
          userId: '1',
          role: SourceMemberRoles.Admin,
          referralToken: 'a',
        },
        {
          sourceId: 'a',
          userId: '3',
          role: SourceMemberRoles.Moderator,
          referralToken: 'b',
        },
      ]);

      const result = await invokeTypedNotificationWorker<'api.v1.source-post-moderation-submitted'>(worker, { post });
      const ctx = result[0].ctx as NotificationPostModerationContext;

      expect(result.length).toEqual(1);
      expect(result[0].type).toEqual('source_post_submitted');
      expect(ctx.userIds.sort()).toEqual(['1', '3']);
    });

    it('should not send notifications to users who have muted this source', async () => {
      const post = {
        sourceId: 'a',
        createdById: '2',
        status: SourcePostModerationStatus.Pending,
      };
      await con
        .getRepository(Source)
        .update({ id: 'a' }, { type: SourceType.Squad });
      await con.getRepository(SourceMember).save([
        {
          sourceId: 'a',
          userId: '1',
          role: SourceMemberRoles.Admin,
          referralToken: 'a',
        },
        {
          sourceId: 'a',
          userId: '3',
          role: SourceMemberRoles.Moderator,
          referralToken: 'b',
        },
      ]);

      // User '3' mutes SourcePostSubmitted notifications for squad 'a'
      await con.getRepository(NotificationPreferenceSource).save({
        userId: '3',
        sourceId: 'a',
        referenceId: 'a',
        notificationType: NotificationType.SourcePostSubmitted,
        type: 'source',
        status: NotificationPreferenceStatus.Muted,
      });

      const result = await invokeTypedNotificationWorker<'api.v1.source-post-moderation-submitted'>(worker, { post });
      const ctx = result[0].ctx as NotificationPostModerationContext;

      expect(result.length).toEqual(1);
      expect(result[0].type).toEqual('source_post_submitted');
      expect(ctx.userIds).toEqual(['1']); // Only admin '1', moderator '3' is filtered out
    });

    it('should send notifications to users who have explicitly subscribed', async () => {
      const post = {
        sourceId: 'a',
        createdById: '2',
        status: SourcePostModerationStatus.Pending,
      };
      await con
        .getRepository(Source)
        .update({ id: 'a' }, { type: SourceType.Squad });
      await con.getRepository(SourceMember).save([
        {
          sourceId: 'a',
          userId: '1',
          role: SourceMemberRoles.Admin,
          referralToken: 'a',
        },
        {
          sourceId: 'a',
          userId: '3',
          role: SourceMemberRoles.Moderator,
          referralToken: 'b',
        },
      ]);

      // User '1' explicitly subscribes to SourcePostSubmitted notifications for squad 'a'
      await con.getRepository(NotificationPreferenceSource).save({
        userId: '1',
        sourceId: 'a',
        referenceId: 'a',
        notificationType: NotificationType.SourcePostSubmitted,
        type: 'source',
        status: NotificationPreferenceStatus.Subscribed,
      });

      const result = await invokeTypedNotificationWorker<'api.v1.source-post-moderation-submitted'>(worker, { post });
      const ctx = result[0].ctx as NotificationPostModerationContext;

      expect(result.length).toEqual(1);
      expect(result[0].type).toEqual('source_post_submitted');
      expect(ctx.userIds.sort()).toEqual(['1', '3']); // Both should receive notifications
    });

    it('should not send notifications to users who have globally muted this notification type', async () => {
      const post = {
        sourceId: 'a',
        createdById: '2',
        status: SourcePostModerationStatus.Pending,
      };
      await con
        .getRepository(Source)
        .update({ id: 'a' }, { type: SourceType.Squad });
      await con.getRepository(SourceMember).save([
        {
          sourceId: 'a',
          userId: '1',
          role: SourceMemberRoles.Admin,
          referralToken: 'a',
        },
        {
          sourceId: 'a',
          userId: '3',
          role: SourceMemberRoles.Moderator,
          referralToken: 'b',
        },
      ]);

      // User '3' globally mutes SourcePostSubmitted notifications
      await con.getRepository(User).update(
        { id: '3' },
        {
          notificationFlags: {
            [NotificationType.SourcePostSubmitted]: {
              email: NotificationPreferenceStatus.Muted,
              inApp: NotificationPreferenceStatus.Muted,
            },
          },
        },
      );

      const result = await invokeTypedNotificationWorker<'api.v1.source-post-moderation-submitted'>(worker, { post });
      const ctx = result[0].ctx as NotificationPostModerationContext;

      expect(result.length).toEqual(1);
      expect(result[0].type).toEqual('source_post_submitted');
      expect(ctx.userIds).toEqual(['1']); // Only admin '1', moderator '3' is filtered out
    });

    it('should not send notifications to users who have subscribed to a specific source but globally muted the notification type', async () => {
      const post = {
        sourceId: 'a',
        createdById: '2',
        status: SourcePostModerationStatus.Pending,
      };
      await con
        .getRepository(Source)
        .update({ id: 'a' }, { type: SourceType.Squad });
      await con.getRepository(SourceMember).save([
        {
          sourceId: 'a',
          userId: '1',
          role: SourceMemberRoles.Admin,
          referralToken: 'a',
        },
        {
          sourceId: 'a',
          userId: '3',
          role: SourceMemberRoles.Moderator,
          referralToken: 'b',
        },
      ]);

      // User '3' explicitly subscribes to SourcePostSubmitted notifications for squad 'a'
      await con.getRepository(NotificationPreferenceSource).save({
        userId: '3',
        sourceId: 'a',
        referenceId: 'a',
        notificationType: NotificationType.SourcePostSubmitted,
        type: 'source',
        status: NotificationPreferenceStatus.Subscribed,
      });

      // But user '3' also globally mutes SourcePostSubmitted notifications
      await con.getRepository(User).update(
        { id: '3' },
        {
          notificationFlags: {
            [NotificationType.SourcePostSubmitted]: {
              email: NotificationPreferenceStatus.Muted,
              inApp: NotificationPreferenceStatus.Muted,
            },
          },
        },
      );

      const result = await invokeTypedNotificationWorker<'api.v1.source-post-moderation-submitted'>(worker, { post });
      const ctx = result[0].ctx as NotificationPostModerationContext;

      expect(result.length).toEqual(1);
      expect(result[0].type).toEqual('source_post_submitted');
      expect(ctx.userIds).toEqual(['1']); // Only admin '1', moderator '3' is filtered out due to global mute
    });

    it('should handle mixed preference scenarios correctly', async () => {
      const post = {
        sourceId: 'a',
        createdById: '2',
        status: SourcePostModerationStatus.Pending,
      };
      await con
        .getRepository(Source)
        .update({ id: 'a' }, { type: SourceType.Squad });
      await con.getRepository(SourceMember).save([
        {
          sourceId: 'a',
          userId: '1',
          role: SourceMemberRoles.Admin,
          referralToken: 'a',
        },
        {
          sourceId: 'a',
          userId: '3',
          role: SourceMemberRoles.Moderator,
          referralToken: 'b',
        },
        {
          sourceId: 'a',
          userId: '4',
          role: SourceMemberRoles.Moderator,
          referralToken: 'c',
        },
      ]);

      // User '1' - no preference (default subscribed)
      // User '3' - source-specific muted
      await con.getRepository(NotificationPreferenceSource).save({
        userId: '3',
        sourceId: 'a',
        referenceId: 'a',
        notificationType: NotificationType.SourcePostSubmitted,
        type: 'source',
        status: NotificationPreferenceStatus.Muted,
      });
      // User '4' - explicitly subscribed
      await con.getRepository(NotificationPreferenceSource).save({
        userId: '4',
        sourceId: 'a',
        referenceId: 'a',
        notificationType: NotificationType.SourcePostSubmitted,
        type: 'source',
        status: NotificationPreferenceStatus.Subscribed,
      });

      const result = await invokeTypedNotificationWorker<'api.v1.source-post-moderation-submitted'>(worker, { post });
      const ctx = result[0].ctx as NotificationPostModerationContext;

      expect(result.length).toEqual(1);
      expect(result[0].type).toEqual('source_post_submitted');
      expect(ctx.userIds.sort()).toEqual(['1', '4']); // '1' (default) and '4' (subscribed), '3' is muted
    });
  });
});
