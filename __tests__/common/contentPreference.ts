import { DataSource } from 'typeorm';
import { usersFixture } from '../fixture/user';
import { saveFixtures } from '../helpers';
import createOrGetConnection from '../../src/db';
import { User } from '../../src/entity/user/User';
import {
  followEntity,
  unfollowEntity,
} from '../../src/common/contentPreference';
import { AuthContext } from '../../src/Context';
import {
  ContentPreferenceStatus,
  ContentPreferenceType,
} from '../../src/entity/contentPreference/types';
import { ContentPreferenceUser } from '../../src/entity/contentPreference/ContentPreferenceUser';
import { NotificationPreferenceUser } from '../../src/entity/notifications/NotificationPreferenceUser';
import {
  NotificationPreferenceStatus,
  NotificationType,
} from '../../src/notifications/common';

let con: DataSource;

beforeEach(async () => {
  con = await createOrGetConnection();
});

describe('followEntity', () => {
  describe('followUser', () => {
    beforeEach(async () => {
      await saveFixtures(
        con,
        User,
        usersFixture.map((item) => {
          return {
            ...item,
            id: `${item.id}-cfe`,
            username: `${item.username}-cfe`,
          };
        }),
      );
    });

    it('should follow user', async () => {
      await followEntity({
        ctx: {
          userId: '1-cfe',
          con,
        } as AuthContext,
        id: '2-cfe',
        entity: ContentPreferenceType.User,
        status: ContentPreferenceStatus.Follow,
      });

      const followPreference = await con
        .getRepository(ContentPreferenceUser)
        .findOneBy({
          userId: '1-cfe',
          referenceUserId: '2-cfe',
        });

      expect(followPreference).not.toBeNull();

      const notificationPreferences = await con
        .getRepository(NotificationPreferenceUser)
        .findBy({
          userId: '1-cfe',
          referenceUserId: '2-cfe',
        });

      expect(notificationPreferences).toHaveLength(0);
    });

    it('should subscribe to user', async () => {
      await followEntity({
        ctx: {
          userId: '1-cfe',
          con,
        } as AuthContext,
        id: '2-cfe',
        entity: ContentPreferenceType.User,
        status: ContentPreferenceStatus.Subscribed,
      });

      const followPreference = await con
        .getRepository(ContentPreferenceUser)
        .findOneBy({
          userId: '1-cfe',
          referenceId: '2-cfe',
          referenceUserId: '2-cfe',
        });

      expect(followPreference).not.toBeNull();

      const notificationPreferences = await con
        .getRepository(NotificationPreferenceUser)
        .findBy({
          userId: '1-cfe',
          referenceId: '2-cfe',
          referenceUserId: '2-cfe',
        });

      expect(notificationPreferences).toHaveLength(1);
      expect(notificationPreferences[0]).toMatchObject({
        userId: '1-cfe',
        referenceId: '2-cfe',
        referenceUserId: '2-cfe',
        status: NotificationPreferenceStatus.Subscribed,
        notificationType: NotificationType.UserPostAdded,
      });
    });
  });

  describe('unfollowUser', () => {
    beforeEach(async () => {
      await saveFixtures(
        con,
        User,
        usersFixture.map((item) => {
          return {
            ...item,
            id: `${item.id}-cfe`,
            username: `${item.username}-cfe`,
          };
        }),
      );
    });

    it('should unfollow user', async () => {
      await saveFixtures(con, ContentPreferenceUser, [
        {
          userId: '1-cfe',
          referenceUserId: '2-cfe',
          referenceId: '2-cfe',
          status: ContentPreferenceStatus.Follow,
        },
      ]);

      await unfollowEntity({
        ctx: {
          userId: '1-cfe',
          con,
        } as AuthContext,
        id: '2-cfe',
        entity: ContentPreferenceType.User,
      });

      const followPreference = await con
        .getRepository(ContentPreferenceUser)
        .findOneBy({
          userId: '1-cfe',
          referenceId: '2-cfe',
          referenceUserId: '2-cfe',
        });

      expect(followPreference).toBeNull();

      const notificationPreferences = await con
        .getRepository(NotificationPreferenceUser)
        .findBy({
          userId: '1-cfe',
          referenceId: '2-cfe',
          referenceUserId: '2-cfe',
        });

      expect(notificationPreferences).toHaveLength(0);
    });

    it('should unsubscribe from user', async () => {
      await saveFixtures(con, NotificationPreferenceUser, [
        {
          userId: '1-cfe',
          referenceUserId: '2-cfe',
          referenceId: '2-cfe',
          notificationType: NotificationType.UserPostAdded,
          status: NotificationPreferenceStatus.Subscribed,
        },
      ]);

      await followEntity({
        ctx: {
          userId: '1-cfe',
          con,
        } as AuthContext,
        id: '2-cfe',
        entity: ContentPreferenceType.User,
        status: ContentPreferenceStatus.Follow,
      });

      const followPreference = await con
        .getRepository(ContentPreferenceUser)
        .findOneBy({
          userId: '1-cfe',
          referenceId: '2-cfe',
          referenceUserId: '2-cfe',
        });

      expect(followPreference).not.toBeNull();

      const notificationPreferences = await con
        .getRepository(NotificationPreferenceUser)
        .findBy({
          userId: '1-cfe',
          referenceId: '2-cfe',
          referenceUserId: '2-cfe',
        });

      expect(notificationPreferences).toHaveLength(0);
    });
  });
});
