import { DataSource } from 'typeorm';
import { userFollowNotification as worker } from '../../../src/workers/notifications/userFollowNotification';
import createOrGetConnection from '../../../src/db';
import { usersFixture } from '../../fixture';
import { notificationWorkers } from '../../../src/workers';
import { invokeTypedNotificationWorker, saveFixtures } from '../../helpers';
import { updateFlagsStatement, type PubSubSchema } from '../../../src/common';
import { NotificationType } from '../../../src/notifications/common';
import type { NotificationUserContext } from '../../../src/notifications';
import { ContentPreferenceUser } from '../../../src/entity/contentPreference/ContentPreferenceUser';
import { ContentPreferenceStatus } from '../../../src/entity/contentPreference/types';
import type { ChangeObject } from '../../../src/types';
import { User } from '../../../src/entity/user/User';
import { Feed } from '../../../src/entity/Feed';

let con: DataSource;

describe('userFollowNotification worker', () => {
  beforeAll(async () => {
    con = await createOrGetConnection();
  });

  beforeEach(async () => {
    jest.resetAllMocks();

    await saveFixtures(
      con,
      User,
      usersFixture.map((user) => {
        return {
          ...user,
          github: undefined,
          id: `ufnw-${user.id}`,
          username: `ufnw-${user.username}`,
        };
      }),
    );
    await saveFixtures(
      con,
      Feed,
      usersFixture.map((user) => {
        return {
          id: `ufnw-${user.id}`,
          userId: `ufnw-${user.id}`,
        };
      }),
    );
  });

  it('should be registered', () => {
    const registeredWorker = notificationWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should send notification on follow', async () => {
    const contentPreference = con.getRepository(ContentPreferenceUser).create({
      referenceId: 'ufnw-2',
      userId: 'ufnw-1',
      status: ContentPreferenceStatus.Follow,
      referenceUserId: 'ufnw-2',
      feedId: 'ufnw-2',
    });

    await con.getRepository(ContentPreferenceUser).save(contentPreference);

    const result = await invokeTypedNotificationWorker<'api.v1.user-follow'>(
      worker,
      {
        payload:
          contentPreference as unknown as ChangeObject<ContentPreferenceUser>,
      } as PubSubSchema['api.v1.user-follow'],
    );

    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(NotificationType.UserFollow);

    const userContext = result![0].ctx as NotificationUserContext;

    expect(userContext.userIds).toEqual(['ufnw-2']);
    expect(userContext.user).toEqual({
      id: 'ufnw-1',
      username: 'ufnw-idoshamun',
      name: 'Ido',
    });
  });

  it('should send notification on subscribe', async () => {
    const contentPreference = con.getRepository(ContentPreferenceUser).create({
      referenceId: 'ufnw-2',
      userId: 'ufnw-1',
      status: ContentPreferenceStatus.Subscribed,
      referenceUserId: 'ufnw-2',
      feedId: 'ufnw-2',
    });

    await con.getRepository(ContentPreferenceUser).save(contentPreference);

    const result = await invokeTypedNotificationWorker<'api.v1.user-follow'>(
      worker,
      {
        payload:
          contentPreference as unknown as ChangeObject<ContentPreferenceUser>,
      } as PubSubSchema['api.v1.user-follow'],
    );

    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(NotificationType.UserFollow);

    const userContext = result![0].ctx as NotificationUserContext;

    expect(userContext.userIds).toEqual(['ufnw-2']);
    expect(userContext.user).toEqual({
      id: 'ufnw-1',
      username: 'ufnw-idoshamun',
      name: 'Ido',
    });
  });

  it('should not send notification if user who followed is vordr', async () => {
    await con.getRepository(User).update(
      { id: 'ufnw-1' },
      {
        flags: updateFlagsStatement<User>({
          vordr: true,
        }),
      },
    );

    const contentPreference = con.getRepository(ContentPreferenceUser).create({
      referenceId: 'ufnw-2',
      userId: 'ufnw-1',
      status: ContentPreferenceStatus.Follow,
      referenceUserId: 'ufnw-2',
      feedId: 'ufnw-2',
    });

    await con.getRepository(ContentPreferenceUser).save(contentPreference);

    const result = await invokeTypedNotificationWorker<'api.v1.user-follow'>(
      worker,
      {
        payload:
          contentPreference as unknown as ChangeObject<ContentPreferenceUser>,
      } as PubSubSchema['api.v1.user-follow'],
    );

    expect(result).toBeUndefined();
  });

  it('should not send notification if user who followed is blocked', async () => {
    const contentPreferenceBlocked = con
      .getRepository(ContentPreferenceUser)
      .create({
        referenceId: 'ufnw-1',
        userId: 'ufnw-2',
        status: ContentPreferenceStatus.Blocked,
        referenceUserId: 'ufnw-1',
        feedId: 'ufnw-2',
      });

    await con
      .getRepository(ContentPreferenceUser)
      .save(contentPreferenceBlocked);

    const contentPreference = con.getRepository(ContentPreferenceUser).create({
      referenceId: 'ufnw-2',
      userId: 'ufnw-1',
      status: ContentPreferenceStatus.Follow,
      referenceUserId: 'ufnw-2',
      feedId: 'ufnw-2',
    });

    await con.getRepository(ContentPreferenceUser).save(contentPreference);

    const result = await invokeTypedNotificationWorker<'api.v1.user-follow'>(
      worker,
      {
        payload:
          contentPreference as unknown as ChangeObject<ContentPreferenceUser>,
      } as PubSubSchema['api.v1.user-follow'],
    );

    expect(result).toBeUndefined();
  });
});
