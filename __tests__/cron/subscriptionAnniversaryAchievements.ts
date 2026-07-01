import { randomUUID } from 'crypto';
import { addMonths, subMonths } from 'date-fns';
import type { DataSource } from 'typeorm';
import { subscriptionAnniversaryAchievementsCron as cron } from '../../src/cron/subscriptionAnniversaryAchievements';
import { crons } from '../../src/cron/index';
import createOrGetConnection from '../../src/db';
import {
  Achievement,
  AchievementEventType,
  AchievementType,
} from '../../src/entity/Achievement';
import { User } from '../../src/entity/user/User';
import { UserAchievement } from '../../src/entity/user/UserAchievement';
import { SubscriptionStatus } from '../../src/common/plus/subscription';
import { SubscriptionCycles } from '../../src/paddle';
import { expectSuccessfulCron, saveFixtures } from '../helpers';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

const achievementId = randomUUID();
const activeUserId = randomUUID();
const giftedUserId = randomUUID();
const hackathonUserId = randomUUID();
const cancelledUserId = randomUUID();
const missingCreatedAtUserId = randomUUID();

beforeEach(async () => {
  await con.getRepository(Achievement).save({
    id: achievementId,
    name: 'Subscription Anniversary Achievement',
    description: 'Stay subscribed to Plus for 12 months',
    image: '',
    type: AchievementType.Milestone,
    eventType: AchievementEventType.SubscriptionAnniversary,
    criteria: { targetCount: 12 },
    points: 10,
  });

  await saveFixtures(con, User, [
    {
      id: activeUserId,
      name: 'Active Plus',
      email: `active-plus-${activeUserId}@daily.dev`,
      username: `active${activeUserId.slice(0, 8)}`,
      infoConfirmed: true,
      subscriptionFlags: {
        cycle: SubscriptionCycles.Monthly,
        createdAt: subMonths(new Date(), 2),
        status: SubscriptionStatus.Active,
      },
    },
    {
      id: giftedUserId,
      name: 'Gifted Plus',
      email: `gifted-plus-${giftedUserId}@daily.dev`,
      username: `gifted${giftedUserId.slice(0, 8)}`,
      infoConfirmed: true,
      subscriptionFlags: {
        cycle: SubscriptionCycles.Yearly,
        createdAt: subMonths(new Date(), 3),
        giftExpirationDate: addMonths(new Date(), 1),
        gifterId: activeUserId,
        status: SubscriptionStatus.Active,
      },
    },
    {
      id: hackathonUserId,
      name: 'Hackathon Plus',
      email: `hackathon-plus-${hackathonUserId}@daily.dev`,
      username: `hack${hackathonUserId.slice(0, 8)}`,
      infoConfirmed: true,
      subscriptionFlags: {
        cycle: 'hackathon' as SubscriptionCycles,
        createdAt: subMonths(new Date(), 13),
        status: SubscriptionStatus.Active,
      },
    },
    {
      id: cancelledUserId,
      name: 'Cancelled Plus',
      email: `cancelled-plus-${cancelledUserId}@daily.dev`,
      username: `cancel${cancelledUserId.slice(0, 8)}`,
      infoConfirmed: true,
      subscriptionFlags: {
        cycle: SubscriptionCycles.Monthly,
        createdAt: subMonths(new Date(), 4),
        status: SubscriptionStatus.Cancelled,
      },
    },
    {
      id: missingCreatedAtUserId,
      name: 'Missing Created At Plus',
      email: `missing-created-at-plus-${missingCreatedAtUserId}@daily.dev`,
      username: `missing${missingCreatedAtUserId.slice(0, 8)}`,
      infoConfirmed: true,
      subscriptionFlags: {
        cycle: SubscriptionCycles.Monthly,
        status: SubscriptionStatus.Active,
      },
    },
  ]);
});

describe('subscriptionAnniversaryAchievements cron', () => {
  it('should be registered', () => {
    const registeredCron = crons.find((item) => item.name === cron.name);

    expect(registeredCron).toBeDefined();
  });

  it('should sync active subscription anniversary progress', async () => {
    await expectSuccessfulCron(cron);

    const progress = await con.getRepository(UserAchievement).find({
      where: { achievementId },
      order: { userId: 'ASC' },
    });

    expect(progress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: activeUserId,
          achievementId,
          progress: 2,
          unlockedAt: null,
        }),
        expect.objectContaining({
          userId: giftedUserId,
          achievementId,
          progress: 3,
          unlockedAt: null,
        }),
        expect.objectContaining({
          userId: hackathonUserId,
          achievementId,
          progress: 13,
          unlockedAt: expect.any(Date),
        }),
      ]),
    );
    expect(progress).toHaveLength(3);
  });
});
