import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { getQuestWindow, rotateQuestPeriod } from '../src/common/quest';
import {
  Quest,
  QuestEventType,
  QuestReward,
  QuestRotation,
  QuestType,
} from '../src/entity';
import { UserQuest } from '../src/entity/user';
import { createMockLogger, saveFixtures } from './helpers';

const questIds = [
  'a1111111-1111-4111-8111-111111111111',
  'b2222222-2222-4222-8222-222222222222',
  'c3333333-3333-4333-8333-333333333333',
  'd4444444-4444-4444-8444-444444444444',
];

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await con.createQueryBuilder().delete().from(UserQuest).execute();
  await con.createQueryBuilder().delete().from(QuestRotation).execute();
  await con.createQueryBuilder().delete().from(QuestReward).execute();
  await con.createQueryBuilder().delete().from(Quest).execute();
});

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
        plusOnly: false,
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
        plusOnly: false,
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
        plusOnly: false,
        eventType: QuestEventType.BookmarkPost,
        criteria: { targetCount: 3 },
        active: true,
        createdAt: new Date('2026-03-04T00:00:00.000Z'),
      },
      {
        id: questIds[3],
        name: 'Legacy plus-only quest',
        description: 'Upvote 15 posts',
        type: QuestType.Daily,
        plusOnly: true,
        eventType: QuestEventType.PostUpvote,
        criteria: { targetCount: 15 },
        active: true,
        createdAt: new Date('2026-03-03T00:00:00.000Z'),
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
});
