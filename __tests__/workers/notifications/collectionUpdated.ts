import { DataSource, In } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import {
  expectSuccessfulBackground,
  invokeTypedNotificationWorker,
  saveFixtures,
} from '../../helpers';
import { collectionUpdated as worker } from '../../../src/workers/notifications/collectionUpdated';
import {
  ArticlePost,
  CollectionPost,
  NotificationAvatarV2,
  NotificationPreferencePost,
  NotificationV2,
  PostOrigin,
  PostRelation,
  PostRelationType,
  PostType,
  Source,
  User,
  UserNotification,
} from '../../../src/entity';
import { sourcesFixture } from '../../fixture/source';
import {
  NotificationPreferenceStatus,
  NotificationType,
} from '../../../src/notifications/common';
import { usersFixture } from '../../fixture/user';
import { NotificationCollectionContext } from '../../../src/notifications';
import {
  notificationWorkerToWorker,
  workers,
} from '../../../src/workers/notifications';
import { addSeconds } from 'date-fns';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, ArticlePost, [
    {
      id: 'cupp1',
      shortId: 'cupp1',
      url: 'http://cupp1.com',
      score: 0,
      metadataChangedAt: new Date('01-05-2020 12:00:00'),
      sourceId: 'a',
      visible: true,
      createdAt: new Date('01-05-2020 12:00:00'),
      origin: PostOrigin.Crawler,
      yggdrasilId: '3d5da6ec-b960-4ad8-8278-665a66b71c1f',
    },
    {
      id: 'cupp2',
      shortId: 'cupp2',
      url: 'http://cupp2.com',
      score: 0,
      metadataChangedAt: new Date('01-05-2020 12:00:00'),
      sourceId: 'b',
      visible: true,
      createdAt: new Date('01-05-2020 12:00:00'),
      origin: PostOrigin.Crawler,
      yggdrasilId: '5a829977-189a-4ac9-85cc-9e822cc7c737',
    },
    {
      id: 'cupp3',
      shortId: 'cupp3',
      url: 'http://cupp3.com',
      score: 0,
      metadataChangedAt: new Date('01-05-2020 12:00:00'),
      sourceId: 'c',
      visible: true,
      createdAt: new Date('01-05-2020 12:00:00'),
      origin: PostOrigin.Crawler,
      yggdrasilId: '0920dcaa-60f1-4136-b10e-14804e3dfffd',
    },
    {
      id: 'cupp4',
      shortId: 'cupp4',
      url: 'http://cupp4.com',
      score: 0,
      metadataChangedAt: new Date('01-05-2020 12:00:00'),
      sourceId: 'community',
      visible: true,
      createdAt: new Date('01-05-2020 12:00:00'),
      origin: PostOrigin.Crawler,
      yggdrasilId: '25918bbc-e883-4d5a-bf98-c55272b8543c',
    },
    {
      id: 'cupp5',
      shortId: 'cupp5',
      url: 'http://cupp5.com',
      score: 0,
      metadataChangedAt: new Date('01-05-2020 12:00:00'),
      sourceId: 'community',
      visible: true,
      createdAt: new Date('01-05-2020 12:00:00'),
      origin: PostOrigin.Crawler,
      yggdrasilId: '5a829977-189a-4ac9-85cc-9e822cc7c738',
    },
  ]);
  await saveFixtures(con, CollectionPost, [
    {
      id: 'cup1',
      shortId: 'cup1',
      title: 'My collection',
      score: 0,
      metadataChangedAt: new Date('01-05-2020 12:00:00'),
      sourceId: 'a',
      visible: true,
      createdAt: new Date('01-05-2020 12:00:00'),
      yggdrasilId: '01893589-6627-46cc-a752-4941da92006f',
    },
    {
      id: 'cup2',
      shortId: 'cup2',
      title: 'My collection 2',
      score: 0,
      metadataChangedAt: new Date('01-05-2020 12:00:00'),
      sourceId: 'a',
      visible: true,
      createdAt: new Date('01-05-2020 12:00:00'),
      yggdrasilId: 'c2c88c38-16da-4046-b150-7d518ab341dc',
    },
  ]);
  const createdAt = new Date();
  await saveFixtures(con, PostRelation, [
    {
      postId: 'cup1',
      relatedPostId: 'cupp1',
      type: PostRelationType.Collection,
      createdAt: addSeconds(createdAt, 4),
    },
    {
      postId: 'cup1',
      relatedPostId: 'cupp2',
      type: PostRelationType.Collection,
      createdAt: addSeconds(createdAt, 3),
    },
    {
      postId: 'cup1',
      relatedPostId: 'cupp3',
      type: PostRelationType.Collection,
      createdAt: addSeconds(createdAt, 2),
    },
    {
      postId: 'cup1',
      relatedPostId: 'cupp4',
      type: PostRelationType.Collection,
      createdAt: addSeconds(createdAt, 1),
    },
  ]);
  await saveFixtures(con, NotificationPreferencePost, [
    {
      userId: '1',
      referenceId: 'cup1',
      notificationType: NotificationType.CollectionUpdated,
      status: NotificationPreferenceStatus.Subscribed,
    },
    {
      userId: '2',
      referenceId: 'cup1',
      notificationType: NotificationType.CollectionUpdated,
      status: NotificationPreferenceStatus.Subscribed,
    },
    {
      userId: '3',
      referenceId: 'cup1',
      notificationType: NotificationType.CollectionUpdated,
      status: NotificationPreferenceStatus.Subscribed,
    },
    {
      userId: '4',
      referenceId: 'cup1',
      notificationType: NotificationType.CollectionUpdated,
      status: NotificationPreferenceStatus.Muted,
    },
  ]);
});

describe('collectionUpdated worker', () => {
  it('should be registered', () => {
    const registeredWorker = workers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should notify when a collection is updated', async () => {
    const actual =
      await invokeTypedNotificationWorker<'api.v1.post-collection-updated'>(
        worker,
        {
          post: {
            id: 'cup1',
            title: 'My collection',
            type: PostType.Collection,
          },
        },
      );

    expect(actual.length).toEqual(1);

    const ctx = actual[0].ctx as NotificationCollectionContext;
    expect(actual[0].type).toEqual('collection_updated');
    expect(ctx.post.id).toEqual('cup1');
    expect(ctx.sources.length).toEqual(3);
    expect(ctx.total).toEqual('4');
    expect(actual[0].ctx.userIds).toIncludeSameMembers(['1', '2', '3']);

    expect(ctx.sources.map((item) => item.name)).toIncludeSameMembers([
      'A',
      'B',
      'C',
    ]);
  });

  it('should generate valid notification', async () => {
    await expectSuccessfulBackground(notificationWorkerToWorker(worker), {
      post: {
        id: 'cup1',
        title: 'My collection',
        type: PostType.Collection,
      },
    });

    const notification = await con.getRepository(NotificationV2).findOneBy({
      referenceId: 'cup1',
    });
    const users = await con
      .getRepository(UserNotification)
      .findBy({ notificationId: notification.id });
    expect(users.length).toEqual(3);

    const collectionPost = await con
      .getRepository(CollectionPost)
      .findOneBy({ id: 'cup1' });

    expect(collectionPost).not.toBeNull();

    expect(notification).toMatchObject({
      type: 'collection_updated',
      icon: 'Bell',
      title:
        'The collection "<b>My collection</b>" just got updated with new details',
      description: null,
      targetUrl: 'http://localhost:5002/posts/cup1',
      public: true,
      referenceId: 'cup1',
      referenceType: 'post',
      numTotalAvatars: 4,
      uniqueKey: collectionPost?.metadataChangedAt.toString(),
    });

    const avatars = await con
      .getRepository(NotificationAvatarV2)
      .find({ where: { id: In(notification.avatars) } });

    expect(avatars.length).toEqual(3);
    avatars.forEach((item) => {
      expect(['a', 'b', 'c'].includes(item.referenceId));
      expect(item.targetUrl).toBeTruthy();
      const source = sourcesFixture.find(
        (source) => source.id === item.referenceId,
      );
      expect(source!.handle).toBeTruthy();
      expect(item.targetUrl).toBe(
        `http://localhost:5002/sources/${source!.handle}`,
      );
    });
  });

  it('should not notify when a collection is updated but the user is muted', async () => {
    const actual =
      await invokeTypedNotificationWorker<'api.v1.post-collection-updated'>(
        worker,
        {
          post: {
            id: 'cup1',
            title: 'My collection',
            type: PostType.Collection,
          },
        },
      );

    expect(actual.length).toEqual(1);
    expect(actual[0].ctx.userIds.includes('4')).toBeFalsy();
  });

  it('should notify when a collection is updated but the no sources are found', async () => {
    const actual =
      await invokeTypedNotificationWorker<'api.v1.post-collection-updated'>(
        worker,
        {
          post: {
            id: 'cup2',
            title: 'My collection',
            type: PostType.Collection,
          },
        },
      );

    expect(actual.length).toEqual(1);
    expect((actual[0].ctx as NotificationCollectionContext).total).toEqual(0);
  });

  it('should notify when a collection is updated with an existing source', async () => {
    await saveFixtures(con, PostRelation, [
      {
        postId: 'cup1',
        relatedPostId: 'cupp5',
        type: PostRelationType.Collection,
      },
    ]);
    const actual =
      await invokeTypedNotificationWorker<'api.v1.post-collection-updated'>(
        worker,
        {
          post: {
            id: 'cup1',
            title: 'My collection',
            type: PostType.Collection,
          },
        },
      );

    expect(actual.length).toEqual(1);
    expect((actual[0].ctx as NotificationCollectionContext).total).toEqual('5');
  });
});
