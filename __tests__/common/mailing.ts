import nock from 'nock';
import { DataSource, In } from 'typeorm';
import { saveFixtures } from '../helpers';
import createOrGetConnection from '../../src/db';
import {
  User,
  UserPersonalizedDigest,
  UserPersonalizedDigestSendType,
  UserPersonalizedDigestType,
} from '../../src/entity';
import { usersFixture } from '../fixture/user';
import { syncSubscription, updateFlagsStatement } from '../../src/common';
import { CioUnsubscribeTopic } from '../../src/cio';
import * as cio from '../../src/cio';
import {
  NotificationType,
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationPreferenceStatus,
} from '../../src/notifications/common';
import type { UserNotificationFlags } from '../../src/entity/user/User';
import { logger } from '../../src/logger';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  nock.cleanAll();
  process.env.CIO_APP_KEY = 'test';
  await saveFixtures(
    con,
    User,
    usersFixture.map((item) => {
      return {
        ...item,
        id: `mss-${item.id}`,
      };
    }),
  );
});

describe('mailing', () => {
  describe('syncSubscription', () => {
    it('sync subscriptions for the given users', async () => {
      let users = await con.getRepository(User).find({
        where: {
          id: In(usersFixture.map((user) => `mss-${user.id}`)),
        },
      });

      nock(`https://api.customer.io`)
        .post('/v1/customers/attributes', {
          ids: users.map((user) => user.id),
        })
        .reply(200, {
          customers: users.map((user) => ({
            id: user.id,
            attributes: {
              cio_subscription_preferences: JSON.stringify({
                topics: {
                  [`topic_${CioUnsubscribeTopic.Marketing}`]: false,
                  [`topic_${CioUnsubscribeTopic.Digest}`]: true,
                  [`topic_${CioUnsubscribeTopic.Notifications}`]: true,
                  [`topic_${CioUnsubscribeTopic.Follow}`]: false,
                  [`topic_${CioUnsubscribeTopic.Award}`]: false,
                },
              }),
            },
            unsubscribed: false,
          })),
        });

      await syncSubscription(
        users.map((user) => user.id as string),
        con,
      );

      users = await con.getRepository(User).find({
        where: {
          id: In(usersFixture.map((user) => `mss-${user.id}`)),
        },
        order: {
          id: 'ASC',
        },
      });

      const digests = await con.getRepository(UserPersonalizedDigest).find({
        where: {
          userId: In(users.map((user) => user.id)),
          type: UserPersonalizedDigestType.Digest,
        },
        order: {
          userId: 'ASC',
        },
      });

      expect(digests).toHaveLength(4);

      users.forEach((user, index) => {
        expect(user.acceptedMarketing).toBe(false);
        expect(user.notificationEmail).toBe(true);
        expect(digests[index]).toMatchObject({
          userId: user.id,
          type: UserPersonalizedDigestType.Digest,
        });
        expect(user.followingEmail).toBe(false);
        expect(user.awardEmail).toBe(false);
      });
    });

    it('sync digest subscription with brief', async () => {
      let users = await con.getRepository(User).find({
        where: {
          id: In(usersFixture.map((user) => `mss-${user.id}`)),
        },
      });

      await con.getRepository(UserPersonalizedDigest).update(
        {
          userId: In(users.map((user) => user.id)),
        },
        {
          type: UserPersonalizedDigestType.Brief,
          flags: updateFlagsStatement<UserPersonalizedDigest>({
            sendType: UserPersonalizedDigestSendType.daily,
          }),
        },
      );

      nock(`https://api.customer.io`)
        .post('/v1/customers/attributes', {
          ids: users.map((user) => user.id),
        })
        .reply(200, {
          customers: users.map((user) => ({
            id: user.id,
            attributes: {
              cio_subscription_preferences: JSON.stringify({
                topics: {
                  [`topic_${CioUnsubscribeTopic.Marketing}`]: false,
                  [`topic_${CioUnsubscribeTopic.Digest}`]: true,
                  [`topic_${CioUnsubscribeTopic.Notifications}`]: true,
                  [`topic_${CioUnsubscribeTopic.Follow}`]: false,
                  [`topic_${CioUnsubscribeTopic.Award}`]: false,
                },
              }),
            },
            unsubscribed: false,
          })),
        });

      await syncSubscription(
        users.map((user) => user.id as string),
        con,
      );

      users = await con.getRepository(User).find({
        where: {
          id: In(usersFixture.map((user) => `mss-${user.id}`)),
        },
        order: {
          id: 'ASC',
        },
      });

      const digests = await con.getRepository(UserPersonalizedDigest).find({
        where: {
          userId: In(users.map((user) => user.id)),
          type: UserPersonalizedDigestType.Brief,
        },
        order: {
          userId: 'ASC',
        },
      });

      expect(digests).toHaveLength(4);

      users.forEach((user, index) => {
        expect(user.acceptedMarketing).toBe(false);
        expect(user.notificationEmail).toBe(true);
        expect(digests[index]).toMatchObject({
          userId: user.id,
          type: UserPersonalizedDigestType.Brief,
          flags: {
            sendType: UserPersonalizedDigestSendType.daily,
          },
        });
        expect(user.followingEmail).toBe(false);
        expect(user.awardEmail).toBe(false);
      });
    });

    it('should preserve user-customized notification flags during CIO sync', async () => {
      const customNotificationFlags: UserNotificationFlags = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        [NotificationType.ArticleNewComment]: {
          email: NotificationPreferenceStatus.Subscribed,
          inApp: NotificationPreferenceStatus.Muted,
        },
        [NotificationType.CommentReply]: {
          email: NotificationPreferenceStatus.Muted,
          inApp: NotificationPreferenceStatus.Subscribed,
        },
        [NotificationType.UserReceivedAward]: {
          email: NotificationPreferenceStatus.Subscribed,
          inApp: NotificationPreferenceStatus.Muted,
        },
        [NotificationType.DevCardUnlocked]: {
          email: NotificationPreferenceStatus.Muted,
          inApp: NotificationPreferenceStatus.Muted,
        },
      };

      const testUserIds = usersFixture.map((user) => `mss-${user.id}`);
      await con
        .getRepository(User)
        .update(
          { id: In(testUserIds) },
          { notificationFlags: customNotificationFlags },
        );

      let users = await con.getRepository(User).find({
        where: { id: In(testUserIds) },
        select: ['id', 'notificationFlags'],
      });

      nock(`https://api.customer.io`)
        .post('/v1/customers/attributes', {
          ids: testUserIds,
        })
        .reply(200, {
          customers: users.map((user) => ({
            id: user.id,
            attributes: {
              cio_subscription_preferences: JSON.stringify({
                topics: {
                  [`topic_${CioUnsubscribeTopic.CommentsOnPost}`]: false, // article_new_comment email -> muted
                  [`topic_${CioUnsubscribeTopic.CommentReply}`]: true, // comment_reply email -> subscribed
                  [`topic_${CioUnsubscribeTopic.UserReceivedAward}`]: false, // user_received_award email -> muted
                  [`topic_${CioUnsubscribeTopic.Marketing}`]: true,
                  [`topic_${CioUnsubscribeTopic.Digest}`]: true,
                  [`topic_${CioUnsubscribeTopic.Notifications}`]: true,
                  [`topic_${CioUnsubscribeTopic.Follow}`]: true,
                  [`topic_${CioUnsubscribeTopic.Award}`]: true,
                },
              }),
            },
            unsubscribed: false,
          })),
        });

      await syncSubscription(testUserIds, con);

      users = await con.getRepository(User).find({
        where: { id: In(testUserIds) },
        select: ['id', 'notificationFlags'],
        order: { id: 'ASC' },
      });

      users.forEach((user) => {
        const flags = user.notificationFlags;

        expect(flags[NotificationType.ArticleNewComment].email).toBe(
          NotificationPreferenceStatus.Muted,
        );
        expect(flags[NotificationType.CommentReply].email).toBe(
          NotificationPreferenceStatus.Subscribed,
        );
        expect(flags[NotificationType.UserReceivedAward].email).toBe(
          NotificationPreferenceStatus.Muted,
        );

        expect(flags[NotificationType.ArticleNewComment].inApp).toBe(
          NotificationPreferenceStatus.Muted,
        );
        expect(flags[NotificationType.CommentReply].inApp).toBe(
          NotificationPreferenceStatus.Subscribed,
        );
        expect(flags[NotificationType.UserReceivedAward].inApp).toBe(
          NotificationPreferenceStatus.Muted,
        );

        expect(flags[NotificationType.DevCardUnlocked]).toEqual({
          email: NotificationPreferenceStatus.Muted,
          inApp: NotificationPreferenceStatus.Muted,
        });

        // All notification types should have both email and inApp properties.
        Object.entries(flags).forEach(([, preferences]) => {
          expect(preferences).toHaveProperty('email');
          expect(preferences).toHaveProperty('inApp');
          expect([
            NotificationPreferenceStatus.Muted,
            NotificationPreferenceStatus.Subscribed,
          ]).toContain(preferences.email);
          expect([
            NotificationPreferenceStatus.Muted,
            NotificationPreferenceStatus.Subscribed,
          ]).toContain(preferences.inApp);
        });
      });
    });

    it('should handle validation failures gracefully during CIO sync', async () => {
      const testUserId = `mss-${usersFixture[0].id}`;
      await con.getRepository(User).update(
        { id: testUserId },
        {
          notificationFlags: DEFAULT_NOTIFICATION_SETTINGS,
          acceptedMarketing: false,
          notificationEmail: false,
        },
      );

      const loggerSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

      const mockGetCioTopicsToNotificationFlags = jest
        .spyOn(cio, 'getCioTopicsToNotificationFlags')
        .mockReturnValue({
          // Return invalid data that will fail Zod validation
          [NotificationType.ArticleNewComment]: {
            email: 'muted',
            // Missing inApp field
          },
          // Missing other required notification types
        });

      nock(`https://api.customer.io`)
        .post('/v1/customers/attributes', {
          ids: [testUserId],
        })
        .reply(200, {
          customers: [
            {
              id: testUserId,
              attributes: {
                cio_subscription_preferences: JSON.stringify({
                  topics: {
                    [`topic_${CioUnsubscribeTopic.CommentsOnPost}`]: false,
                  },
                }),
              },
              unsubscribed: false,
            },
          ],
        });

      await syncSubscription([testUserId], con);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          errors: expect.any(Array),
          flags: expect.any(Object),
        }),
        'Failed to validate merged notification flags from CIO sync, skipping notification flags update',
      );

      const user = await con.getRepository(User).findOne({
        where: { id: testUserId },
        select: ['notificationFlags', 'acceptedMarketing', 'notificationEmail'],
      });

      // notificationFlags should remain unchanged due to validation failure
      expect(user.notificationFlags).toEqual(DEFAULT_NOTIFICATION_SETTINGS);

      expect(user.acceptedMarketing).toBe(true); // Updated from CIO
      expect(user.notificationEmail).toBe(true); // Updated from CIO

      mockGetCioTopicsToNotificationFlags.mockRestore();
      loggerSpy.mockRestore();
    });

    it('should handle users with incomplete notification flags during CIO sync', async () => {
      const incompleteFlags: Partial<UserNotificationFlags> = {
        [NotificationType.ArticleNewComment]: {
          email: NotificationPreferenceStatus.Subscribed,
          inApp: NotificationPreferenceStatus.Subscribed,
        },
        [NotificationType.CommentReply]: {
          email: NotificationPreferenceStatus.Muted,
          inApp: NotificationPreferenceStatus.Subscribed,
        },
        // Missing many other notification types that exist in DEFAULT_NOTIFICATION_SETTINGS
      };

      const testUserId = `mss-${usersFixture[0].id}`;
      await con
        .getRepository(User)
        .update(
          { id: testUserId },
          { notificationFlags: incompleteFlags as UserNotificationFlags },
        );

      nock(`https://api.customer.io`)
        .post('/v1/customers/attributes', {
          ids: [testUserId],
        })
        .reply(200, {
          customers: [
            {
              id: testUserId,
              attributes: {
                cio_subscription_preferences: JSON.stringify({
                  topics: {
                    [`topic_${CioUnsubscribeTopic.CommentsOnPost}`]: false,
                    [`topic_${CioUnsubscribeTopic.CommentReply}`]: true,
                    [`topic_${CioUnsubscribeTopic.UserReceivedAward}`]: false,
                  },
                }),
              },
              unsubscribed: false,
            },
          ],
        });

      await syncSubscription([testUserId], con);

      const user = await con.getRepository(User).findOne({
        where: { id: testUserId },
        select: ['notificationFlags'],
      });

      const flags = user.notificationFlags;

      expect(flags[NotificationType.ArticleNewComment].email).toBe(
        NotificationPreferenceStatus.Muted,
      );
      expect(flags[NotificationType.ArticleNewComment].inApp).toBe(
        NotificationPreferenceStatus.Subscribed,
      );
      expect(flags[NotificationType.CommentReply].email).toBe(
        NotificationPreferenceStatus.Subscribed,
      );
      expect(flags[NotificationType.CommentReply].inApp).toBe(
        NotificationPreferenceStatus.Subscribed,
      );

      expect(flags[NotificationType.UserReceivedAward]).toEqual({
        email: NotificationPreferenceStatus.Muted,
        inApp: NotificationPreferenceStatus.Subscribed,
      });

      expect(Object.keys(flags).length).toBeGreaterThan(2);
      expect(flags).toHaveProperty(NotificationType.ArticleNewComment);
      expect(flags).toHaveProperty(NotificationType.CommentReply);
      expect(flags).toHaveProperty(NotificationType.UserReceivedAward);
    });
  });
});
