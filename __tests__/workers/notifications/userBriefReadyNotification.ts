import { DataSource } from 'typeorm';
import { userBriefReadyNotification as worker } from '../../../src/workers/notifications/userBriefReadyNotification';
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

    const result = await invokeTypedNotificationWorker(worker, {
      payload: {
        userId: '1',
        frequency: 'daily',
        modelName: BriefingModel.Default,
      },
      postId,
    } as PubSubSchema['api.v1.brief-ready']);

    expect(result!.length).toEqual(1);
    expect(result![0].type).toEqual(NotificationType.BriefingReady);

    const postContext = result![0].ctx as NotificationPostContext;

    expect(postContext.userIds).toEqual(['1']);
    expect(postContext.post.id).toEqual(postId);
  });
});
