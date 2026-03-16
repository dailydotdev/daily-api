import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { getQuestWindow, rotateQuestPeriod } from '../src/common/quest';
import {
  Quest,
  QuestEventType,
  QuestReward,
  QuestRotation,
  QuestType,
  User,
} from '../src/entity';
import { UserQuest, UserQuestStatus } from '../src/entity/user';
import { createMockLogger, saveFixtures } from './helpers';

const questIds = [
  'a1111111-1111-4111-8111-111111111111',
  'b2222222-2222-4222-8222-222222222222',
  'c3333333-3333-4333-8333-333333333333',
  'd4444444-4444-4444-8444-444444444444',
  'e5555555-5555-4555-8555-555555555555',
  'f6666666-6666-4666-8666-666666666666',
];
const testUserId = '77777777-7777-4777-8777-777777777777';
const previousRotationIds = [
  '10101010-1010-4010-8010-101010101010',
  '20202020-2020-4020-8020-202020202020',
  '30303030-3030-4030-8030-303030303030',
];
const completedUserQuestId = '40404040-4040-4040-8040-404040404040';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await con.createQueryBuilder().delete().from(UserQuest).execute();
  await con.createQueryBuilder().delete().from(QuestRotation).execute();
  await con.createQueryBuilder().delete().from(QuestReward).execute();
  await con.createQueryBuilder().delete().from(Quest).execute();
  await con.getRepository(User).delete({ id: testUserId });
});

const seedDailyQuestPool = async (): Promise<void> => {
  await saveFixtures(con, Quest, [
    {
      id: questIds[0],
      name: 'Rotation regular quest 1',
      description: 'Upvote 5 posts',
      type: QuestType.Daily,
      eventType: QuestEventType.PostUpvote,
      criteria: { targetCount: 5 },
      active: true,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
    },
    {
      id: questIds[1],
      name: 'Rotation regular quest 2',
      description: 'Write 2 comments',
      type: QuestType.Daily,
      eventType: QuestEventType.CommentCreate,
      criteria: { targetCount: 2 },
      active: true,
      createdAt: new Date('2026-03-02T00:00:00.000Z'),
    },
    {
      id: questIds[2],
      name: 'Rotation regular quest 3',
      description: 'Bookmark 3 posts',
      type: QuestType.Daily,
      eventType: QuestEventType.BookmarkPost,
      criteria: { targetCount: 3 },
      active: true,
      createdAt: new Date('2026-03-03T00:00:00.000Z'),
    },
    {
      id: questIds[3],
      name: 'Rotation regular quest 4',
      description: 'React to 4 posts',
      type: QuestType.Daily,
      eventType: QuestEventType.PostUpvote,
      criteria: { targetCount: 4 },
      active: true,
      createdAt: new Date('2026-03-04T00:00:00.000Z'),
    },
    {
      id: questIds[4],
      name: 'Rotation regular quest 5',
      description: 'Read 5 posts',
      type: QuestType.Daily,
      eventType: QuestEventType.PostUpvote,
      criteria: { targetCount: 5 },
      active: true,
      createdAt: new Date('2026-03-05T00:00:00.000Z'),
    },
    {
      id: questIds[5],
      name: 'Rotation regular quest 6',
      description: 'Share 6 posts',
      type: QuestType.Daily,
      eventType: QuestEventType.PostUpvote,
      criteria: { targetCount: 6 },
      active: true,
      createdAt: new Date('2026-03-06T00:00:00.000Z'),
    },
  ]);
};

describe('rotateQuestPeriod', () => {
  it('should fill the plus slot from the normal quest pool', async () => {
    const now = new Date('2026-03-12T12:00:00.000Z');
    const logger = createMockLogger();
    const { periodStart } = getQuestWindow(QuestType.Daily, now);

    await saveFixtures(con, Quest, [
      {
        id: questIds[0],
        name: 'Rotation regular quest 1',
        description: 'Upvote 5 posts',
        type: QuestType.Daily,
        eventType: QuestEventType.PostUpvote,
        criteria: { targetCount: 5 },
        active: true,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      },
      {
        id: questIds[1],
        name: 'Rotation regular quest 2',
        description: 'Write 2 comments',
        type: QuestType.Daily,
        eventType: QuestEventType.CommentCreate,
        criteria: { targetCount: 2 },
        active: true,
        createdAt: new Date('2026-03-02T00:00:00.000Z'),
      },
      {
        id: questIds[2],
        name: 'Rotation regular quest 3',
        description: 'Bookmark 3 posts',
        type: QuestType.Daily,
        eventType: QuestEventType.BookmarkPost,
        criteria: { targetCount: 3 },
        active: true,
        createdAt: new Date('2026-03-04T00:00:00.000Z'),
      },
    ]);

    const result = await rotateQuestPeriod({
      con,
      logger,
      type: QuestType.Daily,
      now,
    });

    const rotations = await con.getRepository(QuestRotation).find({
      where: {
        type: QuestType.Daily,
        periodStart,
      },
      order: {
        plusOnly: 'ASC',
        slot: 'ASC',
      },
    });

    expect(result.attempted).toBe(3);
    expect(result.created).toBe(3);
    expect(rotations).toHaveLength(3);
    expect(
      rotations.map(({ questId, plusOnly, slot }) => ({
        questId,
        plusOnly,
        slot,
      })),
    ).toEqual([
      {
        questId: questIds[0],
        plusOnly: false,
        slot: 1,
      },
      {
        questId: questIds[1],
        plusOnly: false,
        slot: 2,
      },
      {
        questId: questIds[2],
        plusOnly: true,
        slot: 1,
      },
    ]);
  });

  it('should avoid repeating quests from the previous period when enough quests exist', async () => {
    const previousNow = new Date('2026-03-11T12:00:00.000Z');
    const now = new Date('2026-03-12T12:00:00.000Z');
    const logger = createMockLogger();
    const { periodStart, periodEnd } = getQuestWindow(
      QuestType.Daily,
      previousNow,
    );
    const { periodStart: currentPeriodStart } = getQuestWindow(
      QuestType.Daily,
      now,
    );

    await seedDailyQuestPool();
    await saveFixtures(con, QuestRotation, [
      {
        id: previousRotationIds[0],
        questId: questIds[3],
        type: QuestType.Daily,
        plusOnly: false,
        slot: 1,
        periodStart,
        periodEnd,
      },
      {
        id: previousRotationIds[1],
        questId: questIds[4],
        type: QuestType.Daily,
        plusOnly: false,
        slot: 2,
        periodStart,
        periodEnd,
      },
      {
        id: previousRotationIds[2],
        questId: questIds[5],
        type: QuestType.Daily,
        plusOnly: true,
        slot: 1,
        periodStart,
        periodEnd,
      },
    ]);

    const result = await rotateQuestPeriod({
      con,
      logger,
      type: QuestType.Daily,
      now,
    });

    const currentRotations = await con.getRepository(QuestRotation).find({
      where: {
        type: QuestType.Daily,
        periodStart: currentPeriodStart,
      },
      order: {
        plusOnly: 'ASC',
        slot: 'ASC',
      },
    });

    const currentQuestIds = currentRotations.map(
      (rotation) => rotation.questId,
    );
    expect(result.attempted).toBe(3);
    expect(result.created).toBe(3);
    expect(currentQuestIds).toEqual([questIds[0], questIds[1], questIds[2]]);
    expect(currentQuestIds).not.toEqual(
      expect.arrayContaining([questIds[3], questIds[4], questIds[5]]),
    );
  });

  it('should rotate out completed but unclaimed quests in the next period', async () => {
    const previousNow = new Date('2026-03-11T12:00:00.000Z');
    const now = new Date('2026-03-12T12:00:00.000Z');
    const logger = createMockLogger();
    const { periodStart, periodEnd } = getQuestWindow(
      QuestType.Daily,
      previousNow,
    );
    const { periodStart: currentPeriodStart } = getQuestWindow(
      QuestType.Daily,
      now,
    );

    await seedDailyQuestPool();
    await saveFixtures(con, User, [{ id: testUserId }]);
    await saveFixtures(con, QuestRotation, [
      {
        id: previousRotationIds[0],
        questId: questIds[3],
        type: QuestType.Daily,
        plusOnly: false,
        slot: 1,
        periodStart,
        periodEnd,
      },
      {
        id: previousRotationIds[1],
        questId: questIds[4],
        type: QuestType.Daily,
        plusOnly: false,
        slot: 2,
        periodStart,
        periodEnd,
      },
      {
        id: previousRotationIds[2],
        questId: questIds[5],
        type: QuestType.Daily,
        plusOnly: true,
        slot: 1,
        periodStart,
        periodEnd,
      },
    ]);
    await saveFixtures(con, UserQuest, [
      {
        id: completedUserQuestId,
        rotationId: previousRotationIds[0],
        userId: testUserId,
        progress: 5,
        status: UserQuestStatus.Completed,
        completedAt: new Date('2026-03-11T13:00:00.000Z'),
        claimedAt: null,
      },
    ]);

    const result = await rotateQuestPeriod({
      con,
      logger,
      type: QuestType.Daily,
      now,
    });

    const currentRotations = await con.getRepository(QuestRotation).find({
      where: {
        type: QuestType.Daily,
        periodStart: currentPeriodStart,
      },
      order: {
        plusOnly: 'ASC',
        slot: 'ASC',
      },
    });

    const currentQuestIds = currentRotations.map(
      (rotation) => rotation.questId,
    );
    const existingUserQuest = await con
      .getRepository(UserQuest)
      .findOneByOrFail({
        id: completedUserQuestId,
      });

    expect(result.attempted).toBe(3);
    expect(result.created).toBe(3);
    expect(currentQuestIds).toEqual([questIds[0], questIds[1], questIds[2]]);
    expect(currentQuestIds).not.toContain(questIds[3]);
    expect(existingUserQuest.status).toBe(UserQuestStatus.Completed);
    expect(existingUserQuest.claimedAt).toBeNull();
  });

  it('should only reuse previous quests when there are not enough fresh quests left', async () => {
    const previousNow = new Date('2026-03-11T12:00:00.000Z');
    const now = new Date('2026-03-12T12:00:00.000Z');
    const logger = createMockLogger();
    const { periodStart, periodEnd } = getQuestWindow(
      QuestType.Daily,
      previousNow,
    );
    const { periodStart: currentPeriodStart } = getQuestWindow(
      QuestType.Daily,
      now,
    );

    await saveFixtures(con, Quest, [
      {
        id: questIds[0],
        name: 'Rotation regular quest 1',
        description: 'Upvote 5 posts',
        type: QuestType.Daily,
        eventType: QuestEventType.PostUpvote,
        criteria: { targetCount: 5 },
        active: true,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      },
      {
        id: questIds[1],
        name: 'Rotation regular quest 2',
        description: 'Write 2 comments',
        type: QuestType.Daily,
        eventType: QuestEventType.CommentCreate,
        criteria: { targetCount: 2 },
        active: true,
        createdAt: new Date('2026-03-02T00:00:00.000Z'),
      },
      {
        id: questIds[2],
        name: 'Rotation regular quest 3',
        description: 'Bookmark 3 posts',
        type: QuestType.Daily,
        eventType: QuestEventType.BookmarkPost,
        criteria: { targetCount: 3 },
        active: true,
        createdAt: new Date('2026-03-03T00:00:00.000Z'),
      },
      {
        id: questIds[3],
        name: 'Rotation regular quest 4',
        description: 'React to 4 posts',
        type: QuestType.Daily,
        eventType: QuestEventType.PostUpvote,
        criteria: { targetCount: 4 },
        active: true,
        createdAt: new Date('2026-03-04T00:00:00.000Z'),
      },
    ]);
    await saveFixtures(con, QuestRotation, [
      {
        id: previousRotationIds[0],
        questId: questIds[0],
        type: QuestType.Daily,
        plusOnly: false,
        slot: 1,
        periodStart,
        periodEnd,
      },
      {
        id: previousRotationIds[1],
        questId: questIds[1],
        type: QuestType.Daily,
        plusOnly: false,
        slot: 2,
        periodStart,
        periodEnd,
      },
      {
        id: previousRotationIds[2],
        questId: questIds[2],
        type: QuestType.Daily,
        plusOnly: true,
        slot: 1,
        periodStart,
        periodEnd,
      },
    ]);

    const result = await rotateQuestPeriod({
      con,
      logger,
      type: QuestType.Daily,
      now,
    });

    const currentRotations = await con.getRepository(QuestRotation).find({
      where: {
        type: QuestType.Daily,
        periodStart: currentPeriodStart,
      },
      order: {
        plusOnly: 'ASC',
        slot: 'ASC',
      },
    });

    const currentQuestIds = currentRotations.map(
      (rotation) => rotation.questId,
    );
    const repeatedQuestIds = currentQuestIds.filter((questId) =>
      [questIds[0], questIds[1], questIds[2]].includes(questId),
    );

    expect(result.attempted).toBe(3);
    expect(result.created).toBe(3);
    expect(currentRotations).toHaveLength(3);
    expect(currentQuestIds).toContain(questIds[3]);
    expect(new Set(currentQuestIds).size).toBe(3);
    expect(repeatedQuestIds).toHaveLength(2);
  });
});
