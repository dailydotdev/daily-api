import { DataSource } from 'typeorm';
import worker from '../../../src/workers/notifications/squadFeaturedUpdated';
import createOrGetConnection from '../../../src/db';
import { Source, SourceMember, SourceType, User } from '../../../src/entity';
import { sourcesFixture, usersFixture } from '../../fixture';
import { notificationWorkers } from '../../../src/workers';
import { invokeTypedNotificationWorker, saveFixtures } from '../../helpers';
import { SourceMemberRoles } from '../../../src/roles';
import { NotificationSourceContext } from '../../../src/notifications';
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

describe('SquadFeaturedUpdated', () => {
  it('should be registered', () => {
    const registeredWorker = notificationWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should not send notification when squad is not featured', async () => {
    const squad = {
      id: 'a',
      flags: { featured: false },
    };

    const result =
      await invokeTypedNotificationWorker<'api.v1.squad-featured-updated'>(
        worker,
        { squad },
      );

    expect(result).toBeUndefined();
  });

  it('should send notification to admins when squad becomes featured', async () => {
    const squad = {
      id: 'a',
      flags: { featured: true },
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

    const result =
      await invokeTypedNotificationWorker<'api.v1.squad-featured-updated'>(
        worker,
        { squad },
      );
    const ctx = result[0].ctx as NotificationSourceContext;

    expect(result.length).toEqual(1);
    expect(result[0].type).toEqual('squad_featured');
    expect(ctx.source).toEqual(squad);
    expect(ctx.userIds).toEqual(['1']);
  });

  it('should send notification to moderators when squad becomes featured', async () => {
    const squad = {
      id: 'a',
      flags: { featured: true },
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

    const result =
      await invokeTypedNotificationWorker<'api.v1.squad-featured-updated'>(
        worker,
        { squad },
      );
    const ctx = result[0].ctx as NotificationSourceContext;

    expect(result.length).toEqual(1);
    expect(result[0].type).toEqual('squad_featured');
    expect(ctx.source).toEqual(squad);
    expect(ctx.userIds).toEqual(['1']);
  });

  it('should not send notification to regular members', async () => {
    const squad = {
      id: 'a',
      flags: { featured: true },
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
        role: SourceMemberRoles.Member,
        referralToken: 'b',
      },
    ]);

    const result =
      await invokeTypedNotificationWorker<'api.v1.squad-featured-updated'>(
        worker,
        { squad },
      );
    const ctx = result[0].ctx as NotificationSourceContext;

    expect(result.length).toEqual(1);
    expect(result[0].type).toEqual('squad_featured');
    expect(ctx.source).toEqual(squad);
    expect(ctx.userIds).toEqual(['1']);
    const noMembers = ctx.userIds.every((id) => id !== '3');
    expect(noMembers).toBeTruthy();
  });

  it('should not send notification to blocked members', async () => {
    const squad = {
      id: 'a',
      flags: { featured: true },
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
        role: SourceMemberRoles.Blocked,
        referralToken: 'b',
      },
    ]);

    const result =
      await invokeTypedNotificationWorker<'api.v1.squad-featured-updated'>(
        worker,
        { squad },
      );
    const ctx = result[0].ctx as NotificationSourceContext;

    expect(result.length).toEqual(1);
    expect(result[0].type).toEqual('squad_featured');
    expect(ctx.source).toEqual(squad);
    expect(ctx.userIds).toEqual(['1']);
    const noBlocked = ctx.userIds.every((id) => id !== '3');
    expect(noBlocked).toBeTruthy();
  });

  it('should return undefined when no eligible users exist', async () => {
    const squad = {
      id: 'a',
      flags: { featured: true },
    };
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad });
    await con.getRepository(SourceMember).save({
      sourceId: 'a',
      userId: '1',
      role: SourceMemberRoles.Member,
      referralToken: 'a',
    });

    const result =
      await invokeTypedNotificationWorker<'api.v1.squad-featured-updated'>(
        worker,
        { squad },
      );

    expect(result).toBeUndefined();
  });

  describe('content preference filtering', () => {
    it('should send notifications to users with no content preferences (default subscribed)', async () => {
      const squad = {
        id: 'a',
        flags: { featured: true },
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

      const result =
        await invokeTypedNotificationWorker<'api.v1.squad-featured-updated'>(
          worker,
          { squad },
        );
      const ctx = result[0].ctx as NotificationSourceContext;

      expect(result.length).toEqual(1);
      expect(result[0].type).toEqual('squad_featured');
      expect(ctx.userIds.sort()).toEqual(['1', '3']);
    });

    it('should not send notifications to users who have muted this source', async () => {
      const squad = {
        id: 'a',
        flags: { featured: true },
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

      // User '3' mutes SquadFeatured notifications for squad 'a'
      await con.getRepository(NotificationPreferenceSource).save({
        userId: '3',
        sourceId: 'a',
        referenceId: 'a',
        notificationType: NotificationType.SquadFeatured,
        type: 'source',
        status: NotificationPreferenceStatus.Muted,
      });

      const result =
        await invokeTypedNotificationWorker<'api.v1.squad-featured-updated'>(
          worker,
          { squad },
        );
      const ctx = result[0].ctx as NotificationSourceContext;

      expect(result.length).toEqual(1);
      expect(result[0].type).toEqual('squad_featured');
      expect(ctx.userIds).toEqual(['1']); // Only admin '1', moderator '3' is filtered out
    });

    it('should send notifications to users who have explicitly subscribed', async () => {
      const squad = {
        id: 'a',
        flags: { featured: true },
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

      // User '1' explicitly subscribes to SquadFeatured notifications for squad 'a'
      await con.getRepository(NotificationPreferenceSource).save({
        userId: '1',
        sourceId: 'a',
        referenceId: 'a',
        notificationType: NotificationType.SquadFeatured,
        type: 'source',
        status: NotificationPreferenceStatus.Subscribed,
      });

      const result =
        await invokeTypedNotificationWorker<'api.v1.squad-featured-updated'>(
          worker,
          { squad },
        );
      const ctx = result[0].ctx as NotificationSourceContext;

      expect(result.length).toEqual(1);
      expect(result[0].type).toEqual('squad_featured');
      expect(ctx.userIds.sort()).toEqual(['1', '3']); // Both should receive notifications
    });

    it('should not send notifications to users who have globally muted this notification type', async () => {
      const squad = {
        id: 'a',
        flags: { featured: true },
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

      // User '3' globally mutes SquadFeatured notifications
      await con.getRepository(User).update(
        { id: '3' },
        {
          notificationFlags: {
            [NotificationType.SquadFeatured]: {
              email: NotificationPreferenceStatus.Muted,
              inApp: NotificationPreferenceStatus.Muted,
            },
          },
        },
      );

      const result =
        await invokeTypedNotificationWorker<'api.v1.squad-featured-updated'>(
          worker,
          { squad },
        );
      const ctx = result[0].ctx as NotificationSourceContext;

      expect(result.length).toEqual(1);
      expect(result[0].type).toEqual('squad_featured');
      expect(ctx.userIds).toEqual(['1']); // Only admin '1', moderator '3' is filtered out
    });

    it('should not send notifications to users who have subscribed to a specific source but globally muted the notification type', async () => {
      const squad = {
        id: 'a',
        flags: { featured: true },
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

      // User '3' explicitly subscribes to SquadFeatured notifications for squad 'a'
      await con.getRepository(NotificationPreferenceSource).save({
        userId: '3',
        sourceId: 'a',
        referenceId: 'a',
        notificationType: NotificationType.SquadFeatured,
        type: 'source',
        status: NotificationPreferenceStatus.Subscribed,
      });

      // But user '3' also globally mutes SquadFeatured notifications
      await con.getRepository(User).update(
        { id: '3' },
        {
          notificationFlags: {
            [NotificationType.SquadFeatured]: {
              email: NotificationPreferenceStatus.Muted,
              inApp: NotificationPreferenceStatus.Muted,
            },
          },
        },
      );

      const result =
        await invokeTypedNotificationWorker<'api.v1.squad-featured-updated'>(
          worker,
          { squad },
        );
      const ctx = result[0].ctx as NotificationSourceContext;

      expect(result.length).toEqual(1);
      expect(result[0].type).toEqual('squad_featured');
      expect(ctx.userIds).toEqual(['1']); // Only admin '1', moderator '3' is filtered out due to global mute
    });

    it('should handle mixed preference scenarios correctly', async () => {
      const squad = {
        id: 'a',
        flags: { featured: true },
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
        notificationType: NotificationType.SquadFeatured,
        type: 'source',
        status: NotificationPreferenceStatus.Muted,
      });
      // User '4' - explicitly subscribed
      await con.getRepository(NotificationPreferenceSource).save({
        userId: '4',
        sourceId: 'a',
        referenceId: 'a',
        notificationType: NotificationType.SquadFeatured,
        type: 'source',
        status: NotificationPreferenceStatus.Subscribed,
      });

      const result =
        await invokeTypedNotificationWorker<'api.v1.squad-featured-updated'>(
          worker,
          { squad },
        );
      const ctx = result[0].ctx as NotificationSourceContext;

      expect(result.length).toEqual(1);
      expect(result[0].type).toEqual('squad_featured');
      expect(ctx.userIds.sort()).toEqual(['1', '4']); // '1' (default) and '4' (subscribed), '3' is muted
    });

    it('should return undefined when all eligible users have muted notifications', async () => {
      const squad = {
        id: 'a',
        flags: { featured: true },
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

      // Both users mute SquadFeatured notifications for squad 'a'
      await con.getRepository(NotificationPreferenceSource).save([
        {
          userId: '1',
          sourceId: 'a',
          referenceId: 'a',
          notificationType: NotificationType.SquadFeatured,
          type: 'source',
          status: NotificationPreferenceStatus.Muted,
        },
        {
          userId: '3',
          sourceId: 'a',
          referenceId: 'a',
          notificationType: NotificationType.SquadFeatured,
          type: 'source',
          status: NotificationPreferenceStatus.Muted,
        },
      ]);

      const result =
        await invokeTypedNotificationWorker<'api.v1.squad-featured-updated'>(
          worker,
          { squad },
        );

      expect(result).toBeUndefined(); // No notifications should be sent
    });
  });
});
