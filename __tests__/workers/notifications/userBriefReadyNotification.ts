import { DataSource } from 'typeorm';
import { userBriefReadyNotification as worker } from '../../../src/workers/notifications/userBriefReadyNotification';
import { notificationWorkerToWorker } from '../../../src/workers/notifications';
import createOrGetConnection from '../../../src/db';
import { Source, User } from '../../../src/entity';
import { sourcesFixture, usersFixture } from '../../fixture';
import { workers } from '../../../src/workers';
import { invokeTypedNotificationWorker, saveFixtures } from '../../helpers';
import { generateShortId } from '../../../src/ids';
import { BriefPost } from '../../../src/entity/posts/BriefPost';
import type { PubSubSchema } from '../../../src/common';
import { BriefingModel } from '../../../src/integrations/feed';
import { NotificationType } from '../../../src/notifications/common';
import type { NotificationPostContext } from '../../../src/notifications';
import { UserNotification } from '../../../src/entity/notifications/UserNotification';
import { Message } from '../../../src/workers/worker';

let con: DataSource;

describe('userBriefReadyNotification worker', () => {
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

    const post = con.getRepository(BriefPost).create({
      id: postId,
      title: 'Test Brief',
      content: 'This is a test brief content.',
      contentHtml: '<p>This is a test brief content.</p>',
      shortId: postId,
      authorId: '1',
      private: true,
      visible: true,
    });

    await con.getRepository(BriefPost).save(post);

    const result = await invokeTypedNotificationWorker<'api.v1.brief-ready'>(
      worker,
      {
        payload: {
          userId: '1',
          frequency: 'daily',
          modelName: BriefingModel.Default,
        },
        postId,
      } as PubSubSchema['api.v1.brief-ready'],
    );

    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(NotificationType.BriefingReady);

    const postContext = result![0].ctx as NotificationPostContext;

    expect(postContext.userIds).toEqual(['1']);
    expect(postContext.post.id).toEqual(postId);
  });

  it('should pass sendAtMs in context and set showAt on user_notification', async () => {
    const postId = await generateShortId();
    const sendAtMs = new Date('2025-06-01T12:00:00Z').getTime();

    const post = con.getRepository(BriefPost).create({
      id: postId,
      title: 'Test Brief',
      content: 'This is a test brief content.',
      contentHtml: '<p>This is a test brief content.</p>',
      shortId: postId,
      authorId: '1',
      private: true,
      visible: true,
    });

    await con.getRepository(BriefPost).save(post);

    const eventData = {
      payload: {
        userId: '1',
        frequency: 'daily',
        modelName: BriefingModel.Default,
      },
      postId,
      sendAtMs,
    } as PubSubSchema['api.v1.brief-ready'];

    const result = await invokeTypedNotificationWorker<'api.v1.brief-ready'>(
      worker,
      eventData,
    );
    expect(result![0].ctx.sendAtMs).toEqual(sendAtMs);

    const fullWorker = notificationWorkerToWorker(worker);
    const msg: Message = {
      data: Buffer.from(JSON.stringify(eventData), 'utf-8'),
      messageId: '1',
    };
    await fullWorker.handler(msg, con, null, null);

    const userNotification = await con
      .getRepository(UserNotification)
      .findOneBy({ userId: '1' });

    expect(userNotification).not.toBeNull();
    expect(userNotification!.showAt).toEqual(new Date(sendAtMs));
  });
});
