import { DataSource } from 'typeorm';
import { userDigestReadyNotification as worker } from '../../../src/workers/notifications/userDigestReadyNotification';
import createOrGetConnection from '../../../src/db';
import { Source, User } from '../../../src/entity';
import { sourcesFixture, usersFixture } from '../../fixture';
import { workers } from '../../../src/workers';
import { invokeTypedNotificationWorker, saveFixtures } from '../../helpers';
import { generateShortId } from '../../../src/ids';
import { DigestPost } from '../../../src/entity/posts/DigestPost';
import { NotificationType } from '../../../src/notifications/common';
import type { NotificationPostContext } from '../../../src/notifications';

let con: DataSource;

describe('userDigestReadyNotification worker', () => {
  beforeAll(async () => {
    con = await createOrGetConnection();
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, User, usersFixture);
  });

  it('should be registered', () => {
    const registeredWorker = workers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should send notification', async () => {
    const postId = await generateShortId();

    const post = con.getRepository(DigestPost).create({
      id: postId,
      shortId: postId,
      authorId: '1',
      private: true,
      visible: true,
      sourceId: 'a',
      flags: {
        digestPostIds: ['p1', 'p2'],
        collectionSources: ['a'],
        ad: null,
      },
    });

    await con.getRepository(DigestPost).save(post);

    const result = await invokeTypedNotificationWorker<'api.v1.digest-ready'>(
      worker,
      {
        userId: '1',
        postId,
      },
    );

    expect(result).toHaveLength(1);
    expect(result![0].type).toEqual(NotificationType.DigestReady);

    const postContext = result![0].ctx as NotificationPostContext;
    expect(postContext.userIds).toEqual(['1']);
    expect(postContext.post.id).toEqual(postId);
  });

  it('should return undefined when post does not exist', async () => {
    const result = await invokeTypedNotificationWorker<'api.v1.digest-ready'>(
      worker,
      {
        userId: '1',
        postId: 'nonexistent',
      },
    );

    expect(result).toBeUndefined();
  });

  it('should return undefined when user does not exist', async () => {
    const postId = await generateShortId();

    const post = con.getRepository(DigestPost).create({
      id: postId,
      shortId: postId,
      authorId: '1',
      private: true,
      visible: true,
      sourceId: 'a',
      flags: {
        digestPostIds: ['p1'],
        collectionSources: ['a'],
        ad: null,
      },
    });

    await con.getRepository(DigestPost).save(post);

    const result = await invokeTypedNotificationWorker<'api.v1.digest-ready'>(
      worker,
      {
        userId: 'nonexistent-user',
        postId,
      },
    );

    expect(result).toBeUndefined();
  });
});
