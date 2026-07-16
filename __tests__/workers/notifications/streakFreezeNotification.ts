import worker from '../../../src/workers/notifications/streakFreezeNotification';
import { workers } from '../../../src/workers';
import { invokeTypedNotificationWorker } from '../../helpers';
import type { NotificationStreakFreezeContext } from '../../../src/notifications';
import { NotificationType } from '../../../src/notifications/common';

const streak = {
  userId: '1',
  currentStreak: 5,
  totalStreak: 20,
  maxStreak: 10,
  freezesAvailable: 2,
  lastViewAt: Date.now(),
  updatedAt: Date.now(),
};

describe('streakFreezeNotification worker', () => {
  it('should be registered', () => {
    const registeredWorker = workers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should do nothing when the event has no freeze discriminator', async () => {
    const result =
      await invokeTypedNotificationWorker<'api.v1.user-streak-updated'>(
        worker,
        { streak },
      );

    expect(result).toBeUndefined();
  });

  it('should send a StreakFreezeUsed notification when a freeze was consumed', async () => {
    const result =
      await invokeTypedNotificationWorker<'api.v1.user-streak-updated'>(
        worker,
        {
          streak,
          freeze: { date: '2024-06-25T00:00:00.000Z', remainingFreezes: 1 },
        },
      );

    expect(result).toHaveLength(1);
    expect(result[0].type).toEqual(NotificationType.StreakFreezeUsed);

    const ctx = result[0].ctx as NotificationStreakFreezeContext;
    expect(ctx.userIds).toEqual(['1']);
    expect(ctx.streak).toEqual(streak);
    expect(ctx.freeze).toEqual({
      date: '2024-06-25T00:00:00.000Z',
      remainingFreezes: 1,
    });
  });

  it('should also send a StreakFreezeDepleted notification when no freezes remain', async () => {
    const result =
      await invokeTypedNotificationWorker<'api.v1.user-streak-updated'>(
        worker,
        {
          streak,
          freeze: { date: '2024-06-25T00:00:00.000Z', remainingFreezes: 0 },
        },
      );

    expect(result).toHaveLength(2);
    expect(result.map(({ type }) => type)).toEqual([
      NotificationType.StreakFreezeUsed,
      NotificationType.StreakFreezeDepleted,
    ]);
  });
});
