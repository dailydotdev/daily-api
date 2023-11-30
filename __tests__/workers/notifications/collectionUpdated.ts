import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import {
  expectSuccessfulBackground,
  invokeNotificationWorker,
  saveFixtures,
} from '../../helpers';
import { collectionUpdated as worker } from '../../../src/workers/notifications/collectionUpdated';
import {
  ArticlePost,
  CollectionPost,
  Notification,
  NotificationPreferencePost,
  PostOrigin,
  PostRelation,
  PostRelationType,
  PostType,
  Source,
  User,
} from '../../../src/entity';
import { sourcesFixture } from '../../fixture/source';
import {
  NotificationPreferenceStatus,
  NotificationType,
} from '../../../src/notifications/common';
import { usersFixture } from '../../fixture/user';
import { NotificationCollectionContext } from '../../../src/notifications';
import { notificationWorkerToWorker } from '../../../src/workers/notifications';

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
      id: 'cp1',
      shortId: 'cp1',
      url: 'http://cp1.com',
      score: 0,
      metadataChangedAt: new Date('01-05-2020 12:00:00'),
      sourceId: 'a',
      visible: true,
      createdAt: new Date('01-05-2020 12:00:00'),
      origin: PostOrigin.Crawler,
      yggdrasilId: '3d5da6ec-b960-4ad8-8278-665a66b71c1f',
    },
    {
      id: 'cp2',
      shortId: 'cp2',
      url: 'http://cp2.com',
      score: 0,
      metadataChangedAt: new Date('01-05-2020 12:00:00'),
      sourceId: 'b',
      visible: true,
      createdAt: new Date('01-05-2020 12:00:00'),
      origin: PostOrigin.Crawler,
      yggdrasilId: '5a829977-189a-4ac9-85cc-9e822cc7c737',
    },
    {
      id: 'cp3',
      shortId: 'cp3',
      url: 'http://cp3.com',
      score: 0,
      metadataChangedAt: new Date('01-05-2020 12:00:00'),
      sourceId: 'c',
      visible: true,
      createdAt: new Date('01-05-2020 12:00:00'),
      origin: PostOrigin.Crawler,
      yggdrasilId: '5a829977-189a-4ac9-85cc-9e822cc7c737',
    },
    {
      id: 'cp4',
      shortId: 'cp4',
      url: 'http://cp4.com',
      score: 0,
      metadataChangedAt: new Date('01-05-2020 12:00:00'),
      sourceId: 'community',
      visible: true,
      createdAt: new Date('01-05-2020 12:00:00'),
      origin: PostOrigin.Crawler,
      yggdrasilId: '5a829977-189a-4ac9-85cc-9e822cc7c737',
    },
  ]);
  await saveFixtures(con, CollectionPost, [
    {
      id: 'c1',
      shortId: 'c1',
      title: 'My collection',
      score: 0,
      metadataChangedAt: new Date('01-05-2020 12:00:00'),
      sourceId: 'a',
      visible: true,
      createdAt: new Date('01-05-2020 12:00:00'),
      yggdrasilId: '7ec0bccb-e41f-4c77-a3b4-fe19d20b3874',
    },
  ]);
  await saveFixtures(con, PostRelation, [
    {
      postId: 'c1',
      relatedPostId: 'cp1',
      type: PostRelationType.Collection,
    },
    {
      postId: 'c1',
      relatedPostId: 'cp2',
      type: PostRelationType.Collection,
    },
    {
      postId: 'c1',
      relatedPostId: 'cp3',
      type: PostRelationType.Collection,
    },
    {
      postId: 'c1',
      relatedPostId: 'cp4',
      type: PostRelationType.Collection,
    },
  ]);

  await saveFixtures(con, NotificationPreferencePost, [
    {
      userId: '1',
      referenceId: 'c1',
      notificationType: NotificationType.CollectionUpdated,
      status: NotificationPreferenceStatus.Subscribed,
    },
    {
      userId: '2',
      referenceId: 'c1',
      notificationType: NotificationType.CollectionUpdated,
      status: NotificationPreferenceStatus.Subscribed,
    },
    {
      userId: '3',
      referenceId: 'c1',
      notificationType: NotificationType.CollectionUpdated,
      status: NotificationPreferenceStatus.Subscribed,
    },
    {
      userId: '4',
      referenceId: 'c1',
      notificationType: NotificationType.CollectionUpdated,
      status: NotificationPreferenceStatus.Muted,
    },
  ]);
});

describe('collectionUpdated worker', () => {
  it('should notifiy when a collection is updated', async () => {
    const actual = await invokeNotificationWorker(worker, {
      post: {
        id: 'c1',
        title: 'My collection',
        content_type: PostType.Collection,
      },
    });

    expect(actual.length).toEqual(3);

    actual.forEach((bundle) => {
      const ctx = bundle.ctx as NotificationCollectionContext;
      expect(bundle.type).toEqual('collection_updated');
      expect(ctx.post.id).toEqual('c1');
      expect(ctx.distinctSources.length).toEqual(3);
      expect(ctx.total).toEqual('4');
    });
    expect(actual.map((bundle) => bundle.ctx.userId)).toEqual(['1', '2', '3']);

    expect(
      (actual[0].ctx as NotificationCollectionContext).distinctSources[0].name,
    ).toEqual('A');
  });

  it('should generate valid notification', async () => {
    await expectSuccessfulBackground(notificationWorkerToWorker(worker), {
      post: {
        id: 'c1',
        title: 'My collection',
        content_type: PostType.Collection,
      },
    });

    const notifications = await con.getRepository(Notification).findBy({
      referenceId: 'c1',
    });

    expect(notifications.length).toEqual(3);

    const notification = notifications.find((item) => item.userId === '1');

    expect(notification).toMatchObject({
      userId: '1',
      type: 'collection_updated',
      icon: 'DailyDev',
      title:
        'The collection <b>My collection</b> just got updated with new details',
      description: null,
      targetUrl: 'http://localhost:5002/posts/c1',
      public: true,
      referenceId: 'c1',
      referenceType: 'post',
      numTotalAvatars: 4,
    });

    const avatars = await notification!.avatars;

    expect(avatars.length).toEqual(3);
    expect(avatars.map((item) => item.referenceId)).toEqual(['a', 'b', 'c']);
    avatars.forEach((item) => expect(item.targetUrl).toBeTruthy());
  });

  it('should not notify when a collection is updated but the user is muted', async () => {
    const actual = await invokeNotificationWorker(worker, {
      post: {
        id: 'c1',
        title: 'My collection',
        content_type: PostType.Collection,
      },
    });

    actual.map((bundle) => expect(bundle.ctx.userId).not.toEqual('4'));
  });
});
