import type { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { Niche } from '../../../src/entity/Niche';
import { User } from '../../../src/entity/user/User';
import { NotificationType } from '../../../src/notifications/common';
import type { NotificationWorldDistrictLevelUpContext } from '../../../src/notifications';
import { worldDistrictLevelUpNotification as worker } from '../../../src/workers/notifications/worldDistrictLevelUpNotification';
import { workers } from '../../../src/workers';
import { invokeTypedNotificationWorker, saveFixtures } from '../../helpers';
import { usersFixture } from '../../fixture/user';

let con: DataSource;

const nicheRust = '44444444-4444-4444-8444-444444444444';

describe('worldDistrictLevelUpNotification worker', () => {
  beforeAll(async () => {
    con = await createOrGetConnection();
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Niche, [
      { id: nicheRust, slug: 'rust', title: 'Rust' },
    ]);
  });

  it('should be registered', () => {
    const registeredWorker = workers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should notify the owner with the niche title', async () => {
    const result =
      await invokeTypedNotificationWorker<'api.v1.world-district-level-up'>(
        worker,
        { userId: '1', nicheId: nicheRust, level: 7, reads: 42 },
      );

    expect(result).toHaveLength(1);
    expect(result![0].type).toBe(NotificationType.WorldDistrictLevelUp);

    const ctx = result![0].ctx as NotificationWorldDistrictLevelUpContext;
    expect(ctx.userIds).toEqual(['1']);
    expect(ctx.nicheTitle).toBe('Rust');
    expect(ctx.level).toBe(7);
  });

  it('should do nothing when the niche is gone', async () => {
    const result =
      await invokeTypedNotificationWorker<'api.v1.world-district-level-up'>(
        worker,
        {
          userId: '1',
          nicheId: '55555555-5555-4555-8555-555555555555',
          level: 7,
          reads: 42,
        },
      );

    expect(result).toBeUndefined();
  });
});
