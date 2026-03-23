import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
} from './helpers';
import {
  HotTake,
  Post,
  Quest,
  QuestEventType,
  QuestRotation,
  QuestType,
  Source,
  User,
  UserCompany,
  UserQuest,
  UserQuestProfile,
  UserQuestStatus,
  UserStats,
  UserStreak,
} from '../src/entity';
import { PopularHotTake } from '../src/entity/PopularHotTake';
import {
  Achievement,
  AchievementEventType,
  AchievementType,
} from '../src/entity/Achievement';
import { UserAchievement } from '../src/entity/user/UserAchievement';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { hotTakeFixture, usersFixture } from './fixture/user';
import { postsFixture } from './fixture/post';
import { sourcesFixture } from './fixture/source';
import { Company } from '../src/entity/Company';
import { ghostUser, systemUser } from '../src/common';
import { getQuestLevelState, getQuestWindow } from '../src/common/quest';
import { MODERATORS } from '../src/config';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | null = null;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser, []),
  );
  client = state.client;
});

beforeEach(async () => {
  loggedUser = null;
  jest.clearAllMocks();
});

afterAll(async () => disposeGraphQLTesting(state));

describe('leaderboard', () => {
  const LEADERBOARD_FRAGMENT = `
    fragment LeaderboardFragment on Leaderboard {
      score
      user {
        id
        username
      }
    }
  `;

  const QUERY = (limit = 3) => `query Leaderboard($limit: Int = ${limit}) {
      highestReputation(limit: $limit) {
        ...LeaderboardFragment
      }
      longestStreak(limit: $limit) {
        ...LeaderboardFragment
      }
      highestPostViews(limit: $limit) {
        ...LeaderboardFragment
      }
      mostUpvoted(limit: $limit) {
        ...LeaderboardFragment
      }
      mostReferrals(limit: $limit) {
        ...LeaderboardFragment
      }
      mostReadingDays(limit: $limit) {
        ...LeaderboardFragment
      }
      mostVerifiedUsers(limit: $limit) {
        score
        company {
          name
          image
        }
      }
    }
    ${LEADERBOARD_FRAGMENT}
  `;

  beforeEach(async () => {
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, Post, postsFixture);
  });

  it('should return highest reputation', async () => {
    const reputation = [100, 200, 300];
    await saveFixtures(
      con,
      User,
      usersFixture.map((item, index) => {
        return {
          ...item,
          reputation: reputation[index] || 0,
        };
      }),
    );

    const res = await client.query(QUERY());
    expect(res.data.highestReputation).toHaveLength(3);
    expect(res.data.highestReputation).toMatchObject([
      {
        score: 300,
        user: {
          id: '3',
          username: 'nimroddaily',
        },
      },
      {
        score: 200,
        user: {
          id: '2',
          username: 'tsahidaily',
        },
      },
      {
        score: 100,
        user: {
          id: '1',
          username: 'idoshamun',
        },
      },
    ]);
  });

  it('should return longest streak', async () => {
    const streak = [10, 50, 100];
    await saveFixtures(
      con,
      UserStreak,
      streak.map((item, index) => {
        return {
          userId: usersFixture[index].id,
          currentStreak: item,
          maxStreak: item,
          totalStreak: item,
        };
      }),
    );

    const res = await client.query(QUERY());
    expect(res.data.longestStreak).toHaveLength(3);
    expect(res.data.longestStreak).toMatchObject([
      {
        score: 100,
        user: {
          id: '3',
          username: 'nimroddaily',
        },
      },
      {
        score: 50,
        user: {
          id: '2',
          username: 'tsahidaily',
        },
      },
      {
        score: 10,
        user: {
          id: '1',
          username: 'idoshamun',
        },
      },
    ]);
  });

  it('should return most reading days', async () => {
    const streak = [10, 50, 100];
    await saveFixtures(
      con,
      UserStreak,
      streak.map((item, index) => {
        return {
          userId: usersFixture[index].id,
          currentStreak: item,
          maxStreak: item,
          totalStreak: item,
        };
      }),
    );

    const res = await client.query(QUERY());
    expect(res.data.mostReadingDays).toHaveLength(3);
    expect(res.data.mostReadingDays).toMatchObject([
      {
        score: 100,
        user: {
          id: '3',
          username: 'nimroddaily',
        },
      },
      {
        score: 50,
        user: {
          id: '2',
          username: 'tsahidaily',
        },
      },
      {
        score: 10,
        user: {
          id: '1',
          username: 'idoshamun',
        },
      },
    ]);
  });

  it('should return highest post views', async () => {
    const userViews = ['1', '1', '2', '3', '1', '3'];
    const views = [30, 20, 10, 5, 3, 2];
    await saveFixtures(
      con,
      Post,
      userViews.map((userId, index) => {
        return {
          ...postsFixture[index],
          scoutId: userId,
          views: views[index],
        };
      }),
    );
    await con.query(
      `REFRESH MATERIALIZED VIEW ${con.getRepository(UserStats).metadata.tableName}`,
    );

    const res = await client.query(QUERY());
    expect(res.data.highestPostViews).toHaveLength(3);
    expect(res.data.highestPostViews).toMatchObject([
      {
        score: 53,
        user: {
          id: '1',
          username: 'idoshamun',
        },
      },
      {
        score: 10,
        user: {
          id: '2',
          username: 'tsahidaily',
        },
      },
      {
        score: 7,
        user: {
          id: '3',
          username: 'nimroddaily',
        },
      },
    ]);
  });

  it('should return most upvoted', async () => {
    const userUpvotes = ['1', '1', '2', '3', '1', '3'];
    const upvotes = [10, 5, 3, 2, 1, 3];
    await saveFixtures(
      con,
      Post,
      userUpvotes.map((userId, index) => {
        return {
          ...postsFixture[index],
          scoutId: userId,
          upvotes: upvotes[index],
        };
      }),
    );
    await con.query(
      `REFRESH MATERIALIZED VIEW ${con.getRepository(UserStats).metadata.tableName}`,
    );

    const res = await client.query(QUERY());
    expect(res.data.mostUpvoted).toHaveLength(3);
    expect(res.data.mostUpvoted).toMatchObject([
      {
        score: 16,
        user: {
          id: '1',
          username: 'idoshamun',
        },
      },
      {
        score: 5,
        user: {
          id: '3',
          username: 'nimroddaily',
        },
      },
      {
        score: 3,
        user: {
          id: '2',
          username: 'tsahidaily',
        },
      },
    ]);
  });

  it('should return most referrals', async () => {
    const userReferrals = ['1', '1', '2', '3', '1', '3'];
    await saveFixtures(
      con,
      User,
      userReferrals.map((userId, index) => {
        return {
          id: `r${index}`,
          username: `referral${index}`,
          email: `referral${index}@test.com`,
          referralId: userId,
        };
      }),
    );
    await con.query(
      `REFRESH MATERIALIZED VIEW ${con.getRepository(UserStats).metadata.tableName}`,
    );

    const res = await client.query(QUERY());
    expect(res.data.mostReferrals).toHaveLength(3);
    expect(res.data.mostReferrals).toMatchObject([
      {
        score: 3,
        user: {
          id: '1',
          username: 'idoshamun',
        },
      },
      {
        score: 2,
        user: {
          id: '3',
          username: 'nimroddaily',
        },
      },
      {
        score: 1,
        user: {
          id: '2',
          username: 'tsahidaily',
        },
      },
    ]);
  });

  it('should return most verified users', async () => {
    await con.getRepository(Company).save([
      {
        id: '1',
        name: 'Company 1',
        image: 'https://daily.dev/company1.jpg',
        domains: ['company1.com'],
      },
      {
        id: '2',
        name: 'Company 2',
        image: 'https://daily.dev/company2.jpg',
        domains: ['company2.com'],
      },
      {
        id: '3',
        name: 'Company 3',
        image: 'https://daily.dev/company3.jpg',
        domains: ['company3.com'],
      },
    ]);
    await con.getRepository(UserCompany).save([
      {
        userId: '1',
        companyId: '1',
        verified: true,
        email: 'u1@com1.com',
        code: '123',
      },
      {
        userId: '1',
        companyId: '2',
        verified: true,
        email: 'u1@com2.com',
        code: '123',
      },
      {
        userId: '2',
        companyId: '2',
        verified: true,
        email: 'u2@com2.com',
        code: '123',
      },
      {
        userId: '1',
        companyId: '3',
        verified: true,
        email: 'u1@com3.com',
        code: '123',
      },
      {
        userId: '2',
        companyId: '3',
        verified: true,
        email: 'u2@com4.com',
        code: '123',
      },
      {
        userId: '3',
        companyId: '3',
        verified: true,
        email: 'u3@com4.com',
        code: '123',
      },
    ]);
    const res = await client.query(QUERY());
    expect(res.data.mostVerifiedUsers).toHaveLength(3);
    expect(res.data.mostVerifiedUsers).toMatchObject([
      {
        score: 3,
        company: {
          name: 'Company 3',
          image: 'https://daily.dev/company3.jpg',
        },
      },
      {
        score: 2,
        company: {
          name: 'Company 2',
          image: 'https://daily.dev/company2.jpg',
        },
      },
      {
        score: 1,
        company: {
          name: 'Company 1',
          image: 'https://daily.dev/company1.jpg',
        },
      },
    ]);
  });

  describe('mostAchievementPoints', () => {
    const ACHIEVEMENT_QUERY = `
      query MostAchievementPoints($limit: Int) {
        mostAchievementPoints(limit: $limit) {
          score
          user {
            id
            username
          }
        }
      }
    `;

    const createAchievement = (
      overrides: Partial<Achievement> = {},
    ): Partial<Achievement> => ({
      name: 'Test Achievement',
      description: 'A test achievement',
      image: 'https://daily.dev/badge.jpg',
      type: AchievementType.Instant,
      eventType: AchievementEventType.ProfileImageUpdate,
      criteria: {},
      points: 10,
      ...overrides,
    });

    it('should return empty when no achievements are unlocked', async () => {
      const res = await client.query(ACHIEVEMENT_QUERY);
      expect(res.errors).toBeFalsy();
      expect(res.data.mostAchievementPoints).toEqual([]);
    });

    it('should return users ranked by total achievement points', async () => {
      const [a1, a2, a3] = await con.getRepository(Achievement).save([
        createAchievement({ name: 'Achievement 1', points: 10 }),
        createAchievement({
          name: 'Achievement 2',
          points: 20,
          eventType: AchievementEventType.PostUpvote,
        }),
        createAchievement({
          name: 'Achievement 3',
          points: 30,
          eventType: AchievementEventType.CommentUpvote,
        }),
      ]);

      const now = new Date();
      await con.getRepository(UserAchievement).save([
        { userId: '1', achievementId: a1.id, unlockedAt: now },
        { userId: '1', achievementId: a2.id, unlockedAt: now },
        { userId: '2', achievementId: a3.id, unlockedAt: now },
        { userId: '3', achievementId: a1.id, unlockedAt: now },
      ]);

      const res = await client.query(ACHIEVEMENT_QUERY);
      expect(res.errors).toBeFalsy();
      expect(res.data.mostAchievementPoints).toHaveLength(3);
      expect(res.data.mostAchievementPoints).toMatchObject([
        { score: 30, user: { id: '1' } },
        { score: 30, user: { id: '2' } },
        { score: 10, user: { id: '3' } },
      ]);
    });

    it('should rank users who reached the same score earlier higher', async () => {
      const [a1] = await con
        .getRepository(Achievement)
        .save([createAchievement({ name: 'Achievement 1', points: 10 })]);

      await con.getRepository(UserAchievement).save([
        {
          userId: '1',
          achievementId: a1.id,
          unlockedAt: new Date('2024-06-01'),
        },
        {
          userId: '2',
          achievementId: a1.id,
          unlockedAt: new Date('2024-01-01'),
        },
      ]);

      const res = await client.query(ACHIEVEMENT_QUERY);
      expect(res.errors).toBeFalsy();
      expect(res.data.mostAchievementPoints).toMatchObject([
        { score: 10, user: { id: '2' } },
        { score: 10, user: { id: '1' } },
      ]);
    });

    it('should not include achievements that are not unlocked', async () => {
      const [a1, a2] = await con.getRepository(Achievement).save([
        createAchievement({ name: 'Achievement 1', points: 10 }),
        createAchievement({
          name: 'Achievement 2',
          points: 50,
          eventType: AchievementEventType.PostUpvote,
        }),
      ]);

      await con.getRepository(UserAchievement).save([
        { userId: '1', achievementId: a1.id, unlockedAt: new Date() },
        {
          userId: '1',
          achievementId: a2.id,
          unlockedAt: null,
          progress: 5,
        },
      ]);

      const res = await client.query(ACHIEVEMENT_QUERY);
      expect(res.errors).toBeFalsy();
      expect(res.data.mostAchievementPoints).toHaveLength(1);
      expect(res.data.mostAchievementPoints[0]).toMatchObject({
        score: 10,
        user: { id: '1' },
      });
    });

    it('should respect the limit parameter', async () => {
      const [a1] = await con
        .getRepository(Achievement)
        .save([createAchievement({ name: 'Achievement 1', points: 10 })]);

      await con.getRepository(UserAchievement).save([
        { userId: '1', achievementId: a1.id, unlockedAt: new Date() },
        { userId: '2', achievementId: a1.id, unlockedAt: new Date() },
        { userId: '3', achievementId: a1.id, unlockedAt: new Date() },
      ]);

      const res = await client.query(ACHIEVEMENT_QUERY, {
        variables: { limit: 2 },
      });
      expect(res.errors).toBeFalsy();
      expect(res.data.mostAchievementPoints).toHaveLength(2);
    });

    it('should use latest unlock time as tiebreaker across multiple achievements', async () => {
      const [a1, a2] = await con.getRepository(Achievement).save([
        createAchievement({ name: 'Achievement 1', points: 10 }),
        createAchievement({
          name: 'Achievement 2',
          points: 10,
          eventType: AchievementEventType.PostUpvote,
        }),
      ]);

      await con.getRepository(UserAchievement).save([
        {
          userId: '1',
          achievementId: a1.id,
          unlockedAt: new Date('2024-01-01'),
        },
        {
          userId: '1',
          achievementId: a2.id,
          unlockedAt: new Date('2024-12-01'),
        },
        {
          userId: '2',
          achievementId: a1.id,
          unlockedAt: new Date('2024-06-01'),
        },
        {
          userId: '2',
          achievementId: a2.id,
          unlockedAt: new Date('2024-06-15'),
        },
      ]);

      const res = await client.query(ACHIEVEMENT_QUERY);
      expect(res.errors).toBeFalsy();
      expect(res.data.mostAchievementPoints).toMatchObject([
        { score: 20, user: { id: '2' } },
        { score: 20, user: { id: '1' } },
      ]);
    });
  });

  describe('mostQuestsCompleted', () => {
    const QUESTS_COMPLETED_QUERY = `
      query MostQuestsCompleted($limit: Int) {
        mostQuestsCompleted(limit: $limit) {
          score
          user {
            id
            username
          }
        }
      }
    `;

    const createUserQuest = ({
      userId,
      rotationId,
      status,
      completedAt,
      claimedAt,
    }: {
      userId: string;
      rotationId: string;
      status: UserQuestStatus;
      completedAt?: Date | null;
      claimedAt?: Date | null;
    }): Partial<UserQuest> => ({
      userId,
      rotationId,
      status,
      progress: status === UserQuestStatus.InProgress ? 0 : 1,
      completedAt: completedAt ?? null,
      claimedAt: claimedAt ?? null,
    });

    it('should rank users by total completed and claimed quests', async () => {
      await con.getRepository(UserQuest).save([
        createUserQuest({
          userId: '1',
          rotationId: '00000000-0000-0000-0000-000000000001',
          status: UserQuestStatus.Completed,
          completedAt: new Date('2024-01-01'),
        }),
        createUserQuest({
          userId: '1',
          rotationId: '00000000-0000-0000-0000-000000000002',
          status: UserQuestStatus.Completed,
          completedAt: new Date('2024-01-02'),
        }),
        createUserQuest({
          userId: '1',
          rotationId: '00000000-0000-0000-0000-000000000003',
          status: UserQuestStatus.Claimed,
          completedAt: new Date('2024-01-03'),
          claimedAt: new Date('2024-01-04'),
        }),
        createUserQuest({
          userId: '2',
          rotationId: '00000000-0000-0000-0000-000000000004',
          status: UserQuestStatus.Completed,
          completedAt: new Date('2024-01-01'),
        }),
        createUserQuest({
          userId: '2',
          rotationId: '00000000-0000-0000-0000-000000000005',
          status: UserQuestStatus.Claimed,
          completedAt: new Date('2024-01-02'),
          claimedAt: new Date('2024-01-03'),
        }),
        createUserQuest({
          userId: '2',
          rotationId: '00000000-0000-0000-0000-000000000006',
          status: UserQuestStatus.InProgress,
        }),
        createUserQuest({
          userId: '3',
          rotationId: '00000000-0000-0000-0000-000000000007',
          status: UserQuestStatus.Claimed,
          completedAt: new Date('2024-01-05'),
          claimedAt: new Date('2024-01-06'),
        }),
      ]);

      const res = await client.query(QUESTS_COMPLETED_QUERY);

      expect(res.errors).toBeFalsy();
      expect(res.data.mostQuestsCompleted).toMatchObject([
        { score: 3, user: { id: '1', username: 'idoshamun' } },
        { score: 2, user: { id: '2', username: 'tsahidaily' } },
        { score: 1, user: { id: '3', username: 'nimroddaily' } },
      ]);
    });

    it('should rank users who reached the same quest total earlier higher', async () => {
      await con.getRepository(UserQuest).save([
        createUserQuest({
          userId: '1',
          rotationId: '00000000-0000-0000-0000-000000000101',
          status: UserQuestStatus.Completed,
          completedAt: new Date('2024-02-01'),
        }),
        createUserQuest({
          userId: '1',
          rotationId: '00000000-0000-0000-0000-000000000102',
          status: UserQuestStatus.Completed,
          completedAt: new Date('2024-03-01'),
        }),
        createUserQuest({
          userId: '2',
          rotationId: '00000000-0000-0000-0000-000000000103',
          status: UserQuestStatus.Completed,
          completedAt: new Date('2024-01-01'),
        }),
        createUserQuest({
          userId: '2',
          rotationId: '00000000-0000-0000-0000-000000000104',
          status: UserQuestStatus.Claimed,
          completedAt: new Date('2024-01-10'),
          claimedAt: new Date('2024-01-11'),
        }),
      ]);

      const res = await client.query(QUESTS_COMPLETED_QUERY);

      expect(res.errors).toBeFalsy();
      expect(res.data.mostQuestsCompleted).toMatchObject([
        { score: 2, user: { id: '2' } },
        { score: 2, user: { id: '1' } },
      ]);
    });
  });

  describe('questCompletionStats', () => {
    const QUEST_COMPLETION_STATS_QUERY = `
      query QuestCompletionStats {
        questCompletionStats {
          totalCount
          allTimeLeader {
            questId
            questName
            questDescription
            count
          }
          weeklyLeader {
            questId
            questName
            questDescription
            count
          }
        }
      }
    `;

    it('should return the all-time leader, weekly leader, and total completion count', async () => {
      const now = new Date();
      const { periodStart: weekStart } = getQuestWindow(QuestType.Weekly, now);
      const lastWeekStart = new Date(
        weekStart.getTime() - 7 * 24 * 60 * 60 * 1000,
      );

      await saveFixtures(con, Quest, [
        {
          id: '00000000-0000-0000-0000-000000000201',
          name: 'Hot Take Mic Check',
          description: 'Quest 1',
          type: QuestType.Daily,
          eventType: QuestEventType.HotTakeVote,
          criteria: { targetCount: 1 },
          active: true,
        },
        {
          id: '00000000-0000-0000-0000-000000000202',
          name: 'Link Drop',
          description: 'Quest 2',
          type: QuestType.Daily,
          eventType: QuestEventType.PostShare,
          criteria: { targetCount: 1 },
          active: true,
        },
        {
          id: '00000000-0000-0000-0000-000000000203',
          name: 'Save Point',
          description: 'Quest 3',
          type: QuestType.Daily,
          eventType: QuestEventType.BookmarkPost,
          criteria: { targetCount: 1 },
          active: true,
        },
      ]);

      await saveFixtures(con, QuestRotation, [
        {
          id: '00000000-0000-0000-0000-000000000211',
          questId: '00000000-0000-0000-0000-000000000201',
          type: QuestType.Daily,
          plusOnly: false,
          slot: 1,
          periodStart: lastWeekStart,
          periodEnd: new Date(lastWeekStart.getTime() + 24 * 60 * 60 * 1000),
        },
        {
          id: '00000000-0000-0000-0000-000000000212',
          questId: '00000000-0000-0000-0000-000000000201',
          type: QuestType.Daily,
          plusOnly: false,
          slot: 1,
          periodStart: new Date(weekStart.getTime() + 24 * 60 * 60 * 1000),
          periodEnd: new Date(weekStart.getTime() + 2 * 24 * 60 * 60 * 1000),
        },
        {
          id: '00000000-0000-0000-0000-000000000213',
          questId: '00000000-0000-0000-0000-000000000202',
          type: QuestType.Daily,
          plusOnly: false,
          slot: 2,
          periodStart: weekStart,
          periodEnd: new Date(weekStart.getTime() + 24 * 60 * 60 * 1000),
        },
        {
          id: '00000000-0000-0000-0000-000000000214',
          questId: '00000000-0000-0000-0000-000000000202',
          type: QuestType.Daily,
          plusOnly: false,
          slot: 2,
          periodStart: new Date(weekStart.getTime() + 2 * 24 * 60 * 60 * 1000),
          periodEnd: new Date(weekStart.getTime() + 3 * 24 * 60 * 60 * 1000),
        },
        {
          id: '00000000-0000-0000-0000-000000000215',
          questId: '00000000-0000-0000-0000-000000000203',
          type: QuestType.Daily,
          plusOnly: false,
          slot: 3,
          periodStart: lastWeekStart,
          periodEnd: new Date(lastWeekStart.getTime() + 24 * 60 * 60 * 1000),
        },
      ]);

      await con.getRepository(UserQuest).save([
        {
          userId: '1',
          rotationId: '00000000-0000-0000-0000-000000000211',
          status: UserQuestStatus.Completed,
          progress: 1,
          completedAt: new Date(lastWeekStart.getTime() + 6 * 60 * 60 * 1000),
        },
        {
          userId: '2',
          rotationId: '00000000-0000-0000-0000-000000000212',
          status: UserQuestStatus.Claimed,
          progress: 1,
          completedAt: new Date(weekStart.getTime() + 24 * 60 * 60 * 1000),
          claimedAt: new Date(
            weekStart.getTime() + 24 * 60 * 60 * 1000 + 5 * 60 * 1000,
          ),
        },
        {
          userId: '3',
          rotationId: '00000000-0000-0000-0000-000000000211',
          status: UserQuestStatus.Completed,
          progress: 1,
          completedAt: new Date(
            lastWeekStart.getTime() + 12 * 60 * 60 * 1000 + 10 * 60 * 1000,
          ),
        },
        {
          userId: '1',
          rotationId: '00000000-0000-0000-0000-000000000213',
          status: UserQuestStatus.Completed,
          progress: 1,
          completedAt: new Date(weekStart.getTime() + 2 * 60 * 60 * 1000),
        },
        {
          userId: '2',
          rotationId: '00000000-0000-0000-0000-000000000214',
          status: UserQuestStatus.Claimed,
          progress: 1,
          completedAt: new Date(weekStart.getTime() + 2 * 24 * 60 * 60 * 1000),
          claimedAt: new Date(
            weekStart.getTime() + 2 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000,
          ),
        },
        {
          userId: '3',
          rotationId: '00000000-0000-0000-0000-000000000215',
          status: UserQuestStatus.Completed,
          progress: 1,
          completedAt: new Date(lastWeekStart.getTime() + 12 * 60 * 60 * 1000),
        },
      ]);

      const res = await client.query(QUEST_COMPLETION_STATS_QUERY);

      expect(res.errors).toBeFalsy();
      expect(res.data.questCompletionStats).toMatchObject({
        totalCount: 6,
        allTimeLeader: {
          questId: '00000000-0000-0000-0000-000000000201',
          questName: 'Hot Take Mic Check',
          questDescription: 'Quest 1',
          count: 3,
        },
        weeklyLeader: {
          questId: '00000000-0000-0000-0000-000000000202',
          questName: 'Link Drop',
          questDescription: 'Quest 2',
          count: 2,
        },
      });
    });
  });

  describe('popularHotTakes', () => {
    const QUERY = /* GraphQL */ `
      query PopularHotTakes($limit: Int) {
        popularHotTakes(limit: $limit) {
          score
          hotTake {
            id
            title
          }
          user {
            id
          }
        }
      }
    `;

    beforeEach(async () => {
      await saveFixtures(con, HotTake, hotTakeFixture);

      await con.query(
        `REFRESH MATERIALIZED VIEW ${con.getRepository(PopularHotTake).metadata.tableName}`,
      );
    });

    it('should return popular hot takes', async () => {
      const res = await client.query(QUERY);
      expect(res.data.popularHotTakes).toHaveLength(7);
    });

    it('should limit return popular hot takes', async () => {
      const res = await client.query(QUERY, { variables: { limit: 5 } });
      expect(res.data.popularHotTakes).toHaveLength(5);
    });
  });
});

describe('query highestLevel', () => {
  const QUERY = `
    query HighestLevel($limit: Int) {
      highestLevel(limit: $limit) {
        score
        user {
          id
          username
        }
        level {
          level
          totalXp
          xpInLevel
          xpToNextLevel
        }
      }
    }
  `;

  it('should return users ordered by highest XP with computed level data', async () => {
    await saveFixtures(con, User, [
      { id: 'u1', username: 'user1' },
      { id: 'u2', username: 'user2' },
      { id: 'u3', username: 'user3' },
    ]);

    await saveFixtures(con, UserQuestProfile, [
      { userId: 'u1', totalXp: 300 },
      { userId: 'u2', totalXp: 600 },
      { userId: 'u3', totalXp: 50 },
    ]);

    const res = await client.query(QUERY, { variables: { limit: 3 } });

    expect(res.errors).toBeFalsy();
    expect(res.data.highestLevel).toMatchObject([
      {
        score: 600,
        user: { id: 'u2', username: 'user2' },
        level: getQuestLevelState(600),
      },
      {
        score: 300,
        user: { id: 'u1', username: 'user1' },
        level: getQuestLevelState(300),
      },
      {
        score: 50,
        user: { id: 'u3', username: 'user3' },
        level: getQuestLevelState(50),
      },
    ]);
  });

  it('should exclude ghost, system, and moderator users from highest level ranking', async () => {
    const fixtures: Array<Partial<User>> = [
      { id: 'u-regular', username: 'regular' },
      { id: ghostUser.id, username: 'ghost' },
      { id: systemUser.id, username: 'system' },
    ];

    const moderatorId = MODERATORS[0];
    if (moderatorId) {
      fixtures.push({ id: moderatorId, username: 'moderator' });
    }

    await saveFixtures(con, User, fixtures);

    const profileFixtures: Array<Partial<UserQuestProfile>> = [
      { userId: 'u-regular', totalXp: 100 },
      { userId: ghostUser.id, totalXp: 10000 },
      { userId: systemUser.id, totalXp: 9000 },
    ];

    if (moderatorId) {
      profileFixtures.push({ userId: moderatorId, totalXp: 8000 });
    }

    await saveFixtures(con, UserQuestProfile, profileFixtures);

    const res = await client.query(QUERY, { variables: { limit: 10 } });

    expect(res.errors).toBeFalsy();
    const ids = res.data.highestLevel.map(
      (entry: { user: { id: string } }) => entry.user.id,
    );

    expect(ids).toContain('u-regular');
    expect(ids).not.toContain(ghostUser.id);
    expect(ids).not.toContain(systemUser.id);

    if (moderatorId) {
      expect(ids).not.toContain(moderatorId);
    }
  });
});
