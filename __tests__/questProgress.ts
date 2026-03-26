import { randomUUID } from 'node:crypto';
import { DataSource, In } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  Quest,
  QuestEventType,
  QuestRotation,
  QuestType,
  User,
} from '../src/entity';
import { UserQuest, UserQuestStatus } from '../src/entity/user';
import {
  checkQuestProgress,
  syncMilestoneQuestProgress,
} from '../src/common/quest';
import { createMockLogger, saveFixtures } from './helpers';

const userId = '11111111-1111-4111-8111-111111111111';
const questIds = [
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '88888888-8888-4888-8888-888888888881',
  '88888888-8888-4888-8888-888888888882',
  '88888888-8888-4888-8888-888888888883',
];
const rotationIds = [
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
  '77777777-7777-4777-8777-777777777777',
  '99999999-9999-4999-8999-999999999991',
  '99999999-9999-4999-8999-999999999992',
  '99999999-9999-4999-8999-999999999993',
];

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await con.getRepository(UserQuest).delete({ userId });
  await con.getRepository(QuestRotation).delete({ id: In(rotationIds) });
  await con.getRepository(Quest).delete({ id: In(questIds) });
  await con.getRepository(User).delete({ id: userId });
  await saveFixtures(con, User, [{ id: userId }]);
});

describe('checkQuestProgress', () => {
  it('should increment both daily and weekly quest progress for matching event', async () => {
    const now = new Date();
    const logger = createMockLogger();
    const periodStart = new Date(now.getTime() - 60 * 60 * 1000);
    const periodEnd = new Date(now.getTime() + 60 * 60 * 1000);

    await saveFixtures(con, Quest, [
      {
        id: questIds[0],
        name: 'Daily upvotes',
        description: 'Upvote 2 posts',
        type: QuestType.Daily,
        eventType: QuestEventType.PostUpvote,
        criteria: { targetCount: 2 },
        active: true,
      },
      {
        id: questIds[1],
        name: 'Weekly upvotes',
        description: 'Upvote 3 posts',
        type: QuestType.Weekly,
        eventType: QuestEventType.PostUpvote,
        criteria: { targetCount: 3 },
        active: true,
      },
    ]);

    await saveFixtures(con, QuestRotation, [
      {
        id: rotationIds[0],
        questId: questIds[0],
        type: QuestType.Daily,
        plusOnly: false,
        slot: 1,
        periodStart,
        periodEnd,
      },
      {
        id: rotationIds[1],
        questId: questIds[1],
        type: QuestType.Weekly,
        plusOnly: false,
        slot: 1,
        periodStart,
        periodEnd,
      },
    ]);

    const firstUpdate = await checkQuestProgress({
      con,
      logger,
      userId,
      eventType: QuestEventType.PostUpvote,
      incrementBy: 1,
      now,
    });

    expect(firstUpdate).toBe(true);

    let userQuests = await con.getRepository(UserQuest).find({
      where: {
        userId,
      },
      order: {
        rotationId: 'ASC',
      },
    });

    expect(userQuests).toHaveLength(2);
    expect(userQuests[0].progress).toBe(1);
    expect(userQuests[0].status).toBe(UserQuestStatus.InProgress);
    expect(userQuests[1].progress).toBe(1);
    expect(userQuests[1].status).toBe(UserQuestStatus.InProgress);

    const secondUpdate = await checkQuestProgress({
      con,
      logger,
      userId,
      eventType: QuestEventType.PostUpvote,
      incrementBy: 2,
      now,
    });

    expect(secondUpdate).toBe(true);

    userQuests = await con.getRepository(UserQuest).find({
      where: {
        userId,
      },
      order: {
        rotationId: 'ASC',
      },
    });

    expect(userQuests).toHaveLength(2);
    expect(userQuests[0].progress).toBe(2);
    expect(userQuests[0].status).toBe(UserQuestStatus.Completed);
    expect(userQuests[0].completedAt).toBeTruthy();
    expect(userQuests[1].progress).toBe(3);
    expect(userQuests[1].status).toBe(UserQuestStatus.Completed);
    expect(userQuests[1].completedAt).toBeTruthy();
  });

  it('should accumulate concurrent increments for the same quest', async () => {
    const now = new Date();
    const logger = createMockLogger();
    const periodStart = new Date(now.getTime() - 60 * 60 * 1000);
    const periodEnd = new Date(now.getTime() + 60 * 60 * 1000);

    await saveFixtures(con, Quest, [
      {
        id: questIds[0],
        name: 'Daily upvotes',
        description: 'Upvote 100 posts',
        type: QuestType.Daily,
        eventType: QuestEventType.PostUpvote,
        criteria: { targetCount: 100 },
        active: true,
      },
    ]);

    await saveFixtures(con, QuestRotation, [
      {
        id: rotationIds[0],
        questId: questIds[0],
        type: QuestType.Daily,
        plusOnly: false,
        slot: 1,
        periodStart,
        periodEnd,
      },
    ]);

    const incrementCount = 20;

    await Promise.all(
      Array.from({ length: incrementCount }, () =>
        checkQuestProgress({
          con,
          logger,
          userId,
          eventType: QuestEventType.PostUpvote,
          incrementBy: 1,
          now,
        }),
      ),
    );

    const userQuest = await con.getRepository(UserQuest).findOneByOrFail({
      userId,
      rotationId: rotationIds[0],
    });

    expect(userQuest.progress).toBe(incrementCount);
    expect(userQuest.status).toBe(UserQuestStatus.InProgress);
  });

  it('should not advance quest completion milestone on completion alone, only on claim', async () => {
    const now = new Date();
    const logger = createMockLogger();
    const periodStart = new Date(now.getTime() - 60 * 60 * 1000);
    const periodEnd = new Date(now.getTime() + 60 * 60 * 1000);
    const milestonePeriodStart = new Date('2026-03-25T00:00:00.000Z');
    const milestonePeriodEnd = new Date('9999-12-31T23:59:59.000Z');

    await saveFixtures(con, Quest, [
      {
        id: questIds[3],
        name: 'Up and comer',
        description: 'Claim 2 quests',
        type: QuestType.Milestone,
        eventType: QuestEventType.QuestComplete,
        criteria: { targetCount: 2 },
        active: true,
      },
      {
        id: questIds[4],
        name: 'Daily upvotes 1',
        description: 'Upvote 1 post',
        type: QuestType.Daily,
        eventType: QuestEventType.PostUpvote,
        criteria: { targetCount: 1 },
        active: true,
      },
      {
        id: questIds[5],
        name: 'Daily upvotes 2',
        description: 'Upvote 1 more post',
        type: QuestType.Daily,
        eventType: QuestEventType.PostUpvote,
        criteria: { targetCount: 1 },
        active: true,
      },
    ]);

    await saveFixtures(con, QuestRotation, [
      {
        id: rotationIds[3],
        questId: questIds[3],
        type: QuestType.Milestone,
        plusOnly: false,
        slot: 1,
        periodStart: milestonePeriodStart,
        periodEnd: milestonePeriodEnd,
      },
      {
        id: rotationIds[4],
        questId: questIds[4],
        type: QuestType.Daily,
        plusOnly: false,
        slot: 1,
        periodStart,
        periodEnd,
      },
      {
        id: rotationIds[5],
        questId: questIds[5],
        type: QuestType.Daily,
        plusOnly: false,
        slot: 2,
        periodStart,
        periodEnd,
      },
    ]);

    const didUpdate = await checkQuestProgress({
      con,
      logger,
      userId,
      eventType: QuestEventType.PostUpvote,
      incrementBy: 1,
      now,
    });

    expect(didUpdate).toBe(true);

    const userQuests = await con.getRepository(UserQuest).find({
      where: { userId },
      order: { rotationId: 'ASC' },
    });

    expect(userQuests).toHaveLength(3);
    expect(
      userQuests
        .filter(({ rotationId }) =>
          [rotationIds[4], rotationIds[5]].includes(rotationId),
        )
        .map(({ progress, status }) => ({ progress, status })),
    ).toEqual([
      {
        progress: 1,
        status: UserQuestStatus.Completed,
      },
      {
        progress: 1,
        status: UserQuestStatus.Completed,
      },
    ]);

    const milestoneQuest = userQuests.find(
      ({ rotationId }) => rotationId === rotationIds[3],
    );
    expect(milestoneQuest).toMatchObject({
      progress: 0,
      status: UserQuestStatus.InProgress,
    });
  });

  it('should advance quest completion milestone when quests are claimed', async () => {
    const now = new Date();
    const logger = createMockLogger();
    const periodStart = new Date(now.getTime() - 60 * 60 * 1000);
    const periodEnd = new Date(now.getTime() + 60 * 60 * 1000);
    const milestonePeriodStart = new Date('2026-03-25T00:00:00.000Z');
    const milestonePeriodEnd = new Date('9999-12-31T23:59:59.000Z');

    await saveFixtures(con, Quest, [
      {
        id: questIds[3],
        name: 'Up and comer',
        description: 'Claim 2 quests',
        type: QuestType.Milestone,
        eventType: QuestEventType.QuestComplete,
        criteria: { targetCount: 2 },
        active: true,
      },
      {
        id: questIds[4],
        name: 'Daily upvotes 1',
        description: 'Upvote 1 post',
        type: QuestType.Daily,
        eventType: QuestEventType.PostUpvote,
        criteria: { targetCount: 1 },
        active: true,
      },
      {
        id: questIds[5],
        name: 'Daily upvotes 2',
        description: 'Upvote 1 more post',
        type: QuestType.Daily,
        eventType: QuestEventType.PostUpvote,
        criteria: { targetCount: 1 },
        active: true,
      },
    ]);

    await saveFixtures(con, QuestRotation, [
      {
        id: rotationIds[3],
        questId: questIds[3],
        type: QuestType.Milestone,
        plusOnly: false,
        slot: 1,
        periodStart: milestonePeriodStart,
        periodEnd: milestonePeriodEnd,
      },
      {
        id: rotationIds[4],
        questId: questIds[4],
        type: QuestType.Daily,
        plusOnly: false,
        slot: 1,
        periodStart,
        periodEnd,
      },
      {
        id: rotationIds[5],
        questId: questIds[5],
        type: QuestType.Daily,
        plusOnly: false,
        slot: 2,
        periodStart,
        periodEnd,
      },
    ]);

    // Complete the daily quests
    await checkQuestProgress({
      con,
      logger,
      userId,
      eventType: QuestEventType.PostUpvote,
      incrementBy: 1,
      now,
    });

    // Simulate claiming both daily quests
    const dailyUserQuests = await con.getRepository(UserQuest).find({
      where: {
        userId,
        rotationId: In([rotationIds[4], rotationIds[5]]),
      },
    });

    for (const uq of dailyUserQuests) {
      await con
        .getRepository(UserQuest)
        .update(
          { id: uq.id },
          { status: UserQuestStatus.Claimed, claimedAt: now },
        );
    }

    // Sync milestones after claims
    await syncMilestoneQuestProgress({
      con,
      userId,
      eventType: QuestEventType.QuestComplete,
      now,
    });

    const milestoneQuest = await con.getRepository(UserQuest).findOneOrFail({
      where: { userId, rotationId: rotationIds[3] },
    });

    expect(milestoneQuest).toMatchObject({
      progress: 2,
      status: UserQuestStatus.Completed,
    });
  });

  it('should not update claimed quests', async () => {
    const now = new Date();
    const logger = createMockLogger();
    const periodStart = new Date(now.getTime() - 60 * 60 * 1000);
    const periodEnd = new Date(now.getTime() + 60 * 60 * 1000);

    await saveFixtures(con, Quest, [
      {
        id: questIds[0],
        name: 'Daily upvotes',
        description: 'Upvote 2 posts',
        type: QuestType.Daily,
        eventType: QuestEventType.PostUpvote,
        criteria: { targetCount: 2 },
        active: true,
      },
    ]);

    await saveFixtures(con, QuestRotation, [
      {
        id: rotationIds[0],
        questId: questIds[0],
        type: QuestType.Daily,
        plusOnly: false,
        slot: 1,
        periodStart,
        periodEnd,
      },
    ]);

    await saveFixtures(con, UserQuest, [
      {
        id: '88888888-8888-4888-8888-888888888888',
        rotationId: rotationIds[0],
        userId,
        progress: 2,
        status: UserQuestStatus.Claimed,
        completedAt: now,
        claimedAt: now,
      },
    ]);

    const didUpdate = await checkQuestProgress({
      con,
      logger,
      userId,
      eventType: QuestEventType.PostUpvote,
      incrementBy: 5,
      now,
    });

    expect(didUpdate).toBe(false);

    const userQuest = await con.getRepository(UserQuest).findOneByOrFail({
      id: '88888888-8888-4888-8888-888888888888',
    });

    expect(userQuest.progress).toBe(2);
    expect(userQuest.status).toBe(UserQuestStatus.Claimed);
  });

  it('should support multi-click increments for share click quests', async () => {
    const now = new Date();
    const logger = createMockLogger();
    const periodStart = new Date(now.getTime() - 60 * 60 * 1000);
    const periodEnd = new Date(now.getTime() + 60 * 60 * 1000);

    await saveFixtures(con, Quest, [
      {
        id: questIds[2],
        name: 'Share the Wisdom',
        description: 'Get 5 share link clicks',
        type: QuestType.Daily,
        eventType: QuestEventType.SharePostClick,
        criteria: { targetCount: 5 },
        active: true,
      },
    ]);

    await saveFixtures(con, QuestRotation, [
      {
        id: rotationIds[2],
        questId: questIds[2],
        type: QuestType.Daily,
        plusOnly: false,
        slot: 1,
        periodStart,
        periodEnd,
      },
    ]);

    await checkQuestProgress({
      con,
      logger,
      userId,
      eventType: QuestEventType.SharePostClick,
      incrementBy: 3,
      now,
    });

    await checkQuestProgress({
      con,
      logger,
      userId,
      eventType: QuestEventType.SharePostClick,
      incrementBy: 2,
      now,
    });

    const userQuest = await con.getRepository(UserQuest).findOneByOrFail({
      userId,
      rotationId: rotationIds[2],
    });

    expect(userQuest.progress).toBe(5);
    expect(userQuest.status).toBe(UserQuestStatus.Completed);
    expect(userQuest.completedAt).toBeTruthy();
  });

  it.each([
    {
      eventType: QuestEventType.PostShare,
      name: 'Link drop',
      description: 'Create a shared link post',
    },
    {
      eventType: QuestEventType.BookmarkPost,
      name: 'Save point',
      description: 'Bookmark 1 post',
    },
  ])(
    'should complete single-step daily quests for %s',
    async ({ eventType, name, description }) => {
      const now = new Date();
      const logger = createMockLogger();
      const rotationId = randomUUID();
      const questId = randomUUID();
      const periodStart = new Date(now.getTime() - 60 * 60 * 1000);
      const periodEnd = new Date(now.getTime() + 60 * 60 * 1000);

      await saveFixtures(con, Quest, [
        {
          id: questId,
          name,
          description,
          type: QuestType.Daily,
          eventType,
          criteria: { targetCount: 1 },
          active: true,
        },
      ]);

      await saveFixtures(con, QuestRotation, [
        {
          id: rotationId,
          questId,
          type: QuestType.Daily,
          plusOnly: false,
          slot: 1,
          periodStart,
          periodEnd,
        },
      ]);

      const didUpdate = await checkQuestProgress({
        con,
        logger,
        userId,
        eventType,
        incrementBy: 1,
        now,
      });

      expect(didUpdate).toBe(true);

      const userQuest = await con.getRepository(UserQuest).findOneByOrFail({
        userId,
        rotationId,
      });

      expect(userQuest).toMatchObject({
        progress: 1,
        status: UserQuestStatus.Completed,
      });
      expect(userQuest.completedAt).toBeTruthy();
    },
  );

  it('should rethrow quest progress errors for caller retries', async () => {
    const logger = createMockLogger();
    const expectedError = new Error('query failed');
    const failingConnection = {
      getRepository: jest.fn().mockReturnValue({
        find: jest.fn().mockRejectedValue(expectedError),
      }),
    } as unknown as DataSource;

    await expect(
      checkQuestProgress({
        con: failingConnection,
        logger,
        userId,
        eventType: QuestEventType.PostUpvote,
        incrementBy: 1,
      }),
    ).rejects.toThrow('query failed');

    expect(logger.error).toHaveBeenCalled();
  });
});
