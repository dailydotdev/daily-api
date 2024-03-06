import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  Feed,
  FeedSource,
  MachineSource,
  NotificationPreferenceSource,
  User,
} from '../../src/entity';
import {
  NotificationPreferenceStatus,
  NotificationType,
} from '../../src/notifications/common';
import { sourcesFixture } from '../fixture/source';
import { usersFixture } from '../fixture/user';
import { saveFixtures } from '../helpers';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
});

describe('unsubscribe_notification_source_post_added', () => {
  beforeEach(async () => {
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
    await saveFixtures(con, MachineSource, sourcesFixture);
  });

  it('should remove source_post_added subscribe notification preference on feed source block (insert)', async () => {
    await con.getRepository(NotificationPreferenceSource).save({
      userId: '1',
      sourceId: 'a',
      referenceId: 'a',
      status: NotificationPreferenceStatus.Subscribed,
      notificationType: NotificationType.SourcePostAdded,
    });

    const subscription = await con
      .getRepository(NotificationPreferenceSource)
      .findOneBy({
        userId: '1',
        sourceId: 'a',
        referenceId: 'a',
        notificationType: NotificationType.SourcePostAdded,
      });

    expect(subscription).toBeTruthy();

    await con.getRepository(FeedSource).save({
      feedId: '1',
      sourceId: 'a',
    });

    const subscriptionAfter = await con
      .getRepository(NotificationPreferenceSource)
      .findOneBy({
        userId: '1',
        sourceId: 'a',
        referenceId: 'a',
        notificationType: NotificationType.SourcePostAdded,
      });

    expect(subscriptionAfter).toBeFalsy();
  });

  it('should not remove other notification preference on feed source block (insert)', async () => {
    await con.getRepository(NotificationPreferenceSource).save([
      {
        userId: '1',
        sourceId: 'a',
        referenceId: 'a',
        status: NotificationPreferenceStatus.Subscribed,
        notificationType: NotificationType.SourcePostAdded,
      },
      {
        userId: '1',
        sourceId: 'a',
        referenceId: 'a',
        status: NotificationPreferenceStatus.Muted,
        notificationType: NotificationType.SquadPostAdded,
      },
      {
        userId: '1',
        sourceId: 'b',
        referenceId: 'b',
        status: NotificationPreferenceStatus.Subscribed,
        notificationType: NotificationType.SquadPostAdded,
      },
      {
        userId: '2',
        sourceId: 'a',
        referenceId: 'a',
        status: NotificationPreferenceStatus.Subscribed,
        notificationType: NotificationType.SourcePostAdded,
      },
    ]);

    const subscription = await con
      .getRepository(NotificationPreferenceSource)
      .findOneBy({
        userId: '1',
        sourceId: 'a',
        referenceId: 'a',
        notificationType: NotificationType.SourcePostAdded,
      });
    const subscriptionCount = await con
      .getRepository(NotificationPreferenceSource)
      .count();

    expect(subscription).toBeTruthy();
    expect(subscriptionCount).toEqual(4);

    await con.getRepository(FeedSource).save({
      feedId: '1',
      sourceId: 'a',
    });

    const subscriptionAfter = await con
      .getRepository(NotificationPreferenceSource)
      .findOneBy({
        userId: '1',
        sourceId: 'a',
        referenceId: 'a',
        notificationType: NotificationType.SourcePostAdded,
      });
    const subscriptionsCountAfter = await con
      .getRepository(NotificationPreferenceSource)
      .count();

    expect(subscriptionAfter).toBeFalsy();
    expect(subscriptionsCountAfter).toEqual(3);
  });
});
