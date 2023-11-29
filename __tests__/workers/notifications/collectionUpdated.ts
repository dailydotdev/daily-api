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
  FreeformPost,
  PostOrigin,
  PostRelation,
  PostRelationType,
  PostType,
  Source,
} from '../../../src/entity';
import { sourcesFixture } from '../../fixture/source';
import { Worker } from '../../../src/workers/worker';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
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
});

it('should notifiy when a collection is updated', async () => {
  const actual = await invokeNotificationWorker(worker, {
    post: {
      id: 'c1',
      title: 'My collection',
      content_type: PostType.Collection,
    },
  });
});
