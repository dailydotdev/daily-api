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
import { ConflictError } from '../../src/errors';
import { Feed } from '../../src/entity/Feed';

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
      await saveFixtures(
        con,
        Feed,
        usersFixture.map((item) => ({
          id: `${item.id}-cfe`,
          userId: `${item.id}-cfe`,
        })),
      );
    });

    it('should follow user on main feed', async () => {
      await followEntity({
        ctx: {
          userId: '1-cfe',
          con,
        } as AuthContext,
        id: '2-cfe',
        entity: ContentPreferenceType.User,
        status: ContentPreferenceStatus.Follow,
        feedId: '1-cfe',
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

    it('should follow user on custom feed', async () => {
      await con.getRepository(Feed).save({
        id: '2-cfe',
        userId: '1-cfe',
      });
      await followEntity({
        ctx: {
          userId: '1-cfe',
          con,
        } as AuthContext,
        id: '2-cfe',
        entity: ContentPreferenceType.User,
        status: ContentPreferenceStatus.Follow,
        feedId: '2-cfe',
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

    it('should subscribe to user on main feed', async () => {
      await followEntity({
        ctx: {
          userId: '1-cfe',
          con,
        } as AuthContext,
        id: '2-cfe',
        entity: ContentPreferenceType.User,
        status: ContentPreferenceStatus.Subscribed,
        feedId: '1-cfe',
      });

      const followPreference = await con
        .getRepository(ContentPreferenceUser)
        .findOneBy({
          userId: '1-cfe',
          referenceId: '2-cfe',
          referenceUserId: '2-cfe',
        });

      expect(followPreference).not.toBeNull();
    });

    it('should subscribe to user on custom feed', async () => {
      await con.getRepository(Feed).save({
        id: '2-cfe',
        userId: '1-cfe',
      });
      await followEntity({
        ctx: {
          userId: '1-cfe',
          con,
        } as AuthContext,
        id: '2-cfe',
        entity: ContentPreferenceType.User,
        status: ContentPreferenceStatus.Subscribed,
        feedId: '2-cfe',
      });

      const followPreference = await con
        .getRepository(ContentPreferenceUser)
        .findOneBy({
          userId: '1-cfe',
          referenceId: '2-cfe',
          referenceUserId: '2-cfe',
          feedId: '2-cfe',
        });

      expect(followPreference).not.toBeNull();
    });

    it('should not allow following yourself', async () => {
      expect(async () => {
        await followEntity({
          ctx: {
            userId: '1-cfe',
            con,
          } as AuthContext,
          id: '1-cfe',
          entity: ContentPreferenceType.User,
          status: ContentPreferenceStatus.Follow,
        });
      }).rejects.toThrow(new ConflictError('Cannot follow yourself'));
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
      await saveFixtures(
        con,
        Feed,
        usersFixture.map((item) => ({
          id: `${item.id}-cfe`,
          userId: `${item.id}-cfe`,
        })),
      );
    });

    it('should unfollow user from main feed', async () => {
      await saveFixtures(con, ContentPreferenceUser, [
        {
          userId: '1-cfe',
          feedId: '1-cfe',
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
        feedId: '1-cfe',
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

    it('should unsubscribe from user on main feed', async () => {
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
        feedId: '1-cfe',
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
