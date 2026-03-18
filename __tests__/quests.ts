import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  type GraphQLTestClient,
  type GraphQLTestingState,
} from './helpers';
import {
  Achievement,
  AchievementEventType,
  AchievementType,
  Quest,
  QuestEventType,
  QuestReward,
  QuestRewardType,
  QuestRotation,
  QuestType,
  User,
} from '../src/entity';
import {
  UserAchievement,
  UserQuest,
  UserQuestProfile,
  UserQuestStatus,
} from '../src/entity/user';
import appFunc from '../src';
import type { Context } from '../src/Context';
import { FastifyInstance } from 'fastify';

const CLAIM_QUEST_REWARD_MUTATION = `
mutation ClaimQuestReward($userQuestId: ID!) {
  claimQuestReward(userQuestId: $userQuestId) {
    level {
      totalXp
    }
    daily {
      regular {
        userQuestId
        status
        claimable
      }
      plus {
        userQuestId
        status
        claimable
      }
    }
    weekly {
      regular {
        userQuestId
        status
        claimable
      }
      plus {
        userQuestId
        status
        claimable
      }
    }
  }
}
`;

const QUEST_DASHBOARD_QUERY = `
query QuestDashboard {
  questDashboard {
    daily {
      regular {
        rotationId
        locked
        quest {
          id
          name
        }
      }
      plus {
        rotationId
        locked
        quest {
          id
          name
        }
      }
    }
    weekly {
      regular {
        rotationId
      }
      plus {
        rotationId
      }
    }
  }
}
`;

let app: FastifyInstance;
let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | null = null;
let isPlus = false;
const questUserId = '99999999-9999-4999-8999-999999999999';
const questId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const questRewardXpId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const questRotationId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const userQuestId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const extraQuestId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const extraQuestRotationId = '12121212-1212-4121-8121-121212121212';

beforeAll(async () => {
  con = await createOrGetConnection();
  app = await appFunc();
  state = await initializeGraphQLTesting(
    () =>
      new MockContext(con, loggedUser, [], undefined, false, isPlus) as Context,
  );
  client = state.client;
  return app.ready();
});

beforeEach(async () => {
  loggedUser = null;
  isPlus = false;

  await con.createQueryBuilder().delete().from(UserAchievement).execute();
  await con.createQueryBuilder().delete().from(Achievement).execute();
  await con.createQueryBuilder().delete().from(UserQuest).execute();
  await con.createQueryBuilder().delete().from(UserQuestProfile).execute();
  await con.createQueryBuilder().delete().from(QuestRotation).execute();
  await con.createQueryBuilder().delete().from(QuestReward).execute();
  await con.createQueryBuilder().delete().from(Quest).execute();
  await con.getRepository(User).delete({ id: questUserId });
});

const seedQuest = async ({
  userQuestStatus,
  periodStart,
  periodEnd,
}: {
  userQuestStatus: UserQuestStatus;
  periodStart: Date;
  periodEnd: Date;
}) => {
  await saveFixtures(con, User, [{ id: questUserId, reputation: 10 }]);

  await saveFixtures(con, Quest, [
    {
      id: questId,
      name: 'Hold my upvote',
      description: 'Upvote 5 posts',
      type: QuestType.Daily,
      eventType: QuestEventType.PostUpvote,
      criteria: {
        targetCount: 5,
      },
      active: true,
    },
  ]);

  await saveFixtures(con, QuestReward, [
    {
      id: questRewardXpId,
      questId,
      type: QuestRewardType.XP,
      amount: 15,
      metadata: {},
    },
  ]);

  await saveFixtures(con, QuestRotation, [
    {
      id: questRotationId,
      questId,
      type: QuestType.Daily,
      plusOnly: false,
      slot: 1,
      periodStart,
      periodEnd,
    },
  ]);

  await saveFixtures(con, UserQuest, [
    {
      id: userQuestId,
      rotationId: questRotationId,
      userId: questUserId,
      progress: 5,
      status: userQuestStatus,
      completedAt:
        userQuestStatus === UserQuestStatus.Completed ? new Date() : null,
      claimedAt: null,
    },
  ]);
};

describe('claimQuestReward mutation', () => {
  it('should bucket plus slot quests separately from the quest definition', async () => {
    const now = new Date();
    loggedUser = questUserId;
    isPlus = true;

    await saveFixtures(con, User, [{ id: questUserId }]);

    await saveFixtures(con, Quest, [
      {
        id: questId,
        name: 'Normal daily quest',
        description: 'Upvote 5 posts',
        type: QuestType.Daily,
        eventType: QuestEventType.PostUpvote,
        criteria: {
          targetCount: 5,
        },
        active: true,
      },
      {
        id: extraQuestId,
        name: 'Extra daily quest',
        description: 'Write 2 comments',
        type: QuestType.Daily,
        eventType: QuestEventType.CommentCreate,
        criteria: {
          targetCount: 2,
        },
        active: true,
      },
    ]);

    await saveFixtures(con, QuestRotation, [
      {
        id: questRotationId,
        questId,
        type: QuestType.Daily,
        plusOnly: false,
        slot: 1,
        periodStart: new Date(now.getTime() - 60 * 60 * 1000),
        periodEnd: new Date(now.getTime() + 60 * 60 * 1000),
      },
      {
        id: extraQuestRotationId,
        questId: extraQuestId,
        type: QuestType.Daily,
        plusOnly: true,
        slot: 1,
        periodStart: new Date(now.getTime() - 60 * 60 * 1000),
        periodEnd: new Date(now.getTime() + 60 * 60 * 1000),
      },
    ]);

    const res = await client.query(QUEST_DASHBOARD_QUERY);

    expect(res.errors).toBeUndefined();
    expect(res.data.questDashboard.daily.regular).toEqual([
      {
        rotationId: questRotationId,
        locked: false,
        quest: {
          id: questId,
          name: 'Normal daily quest',
        },
      },
    ]);
    expect(res.data.questDashboard.daily.plus).toEqual([
      {
        rotationId: extraQuestRotationId,
        locked: false,
        quest: {
          id: extraQuestId,
          name: 'Extra daily quest',
        },
      },
    ]);
    expect(res.data.questDashboard.weekly.regular).toEqual([]);
    expect(res.data.questDashboard.weekly.plus).toEqual([]);
  });

  it('should claim a completed quest and apply rewards', async () => {
    const now = new Date();
    loggedUser = questUserId;

    await seedQuest({
      userQuestStatus: UserQuestStatus.Completed,
      periodStart: new Date(now.getTime() - 60 * 60 * 1000),
      periodEnd: new Date(now.getTime() + 60 * 60 * 1000),
    });

    const res = await client.mutate(CLAIM_QUEST_REWARD_MUTATION, {
      variables: {
        userQuestId,
      },
    });

    expect(res.errors).toBeUndefined();
    expect(res.data.claimQuestReward.level.totalXp).toBe(15);
    expect(res.data.claimQuestReward.daily.regular).toEqual([
      {
        userQuestId,
        status: UserQuestStatus.Claimed,
        claimable: false,
      },
    ]);

    const [user, profile] = await Promise.all([
      con.getRepository(User).findOneByOrFail({ id: questUserId }),
      con
        .getRepository(UserQuestProfile)
        .findOneByOrFail({ userId: questUserId }),
    ]);

    expect(user.reputation).toBe(10);
    expect(profile.totalXp).toBe(15);
  });

  it('should fail when quest is not completed', async () => {
    const now = new Date();
    loggedUser = questUserId;

    await seedQuest({
      userQuestStatus: UserQuestStatus.InProgress,
      periodStart: new Date(now.getTime() - 60 * 60 * 1000),
      periodEnd: new Date(now.getTime() + 60 * 60 * 1000),
    });

    const res = await client.mutate(CLAIM_QUEST_REWARD_MUTATION, {
      variables: {
        userQuestId,
      },
    });

    expect(res.errors).toHaveLength(1);
    expect(res.errors?.[0]?.message).toBe('Quest is not completed yet');
  });

  it('should increment achievement progress on claim', async () => {
    const now = new Date();
    loggedUser = questUserId;

    const achievementId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    await con.getRepository(Achievement).save({
      id: achievementId,
      name: 'Quest enthusiast test',
      description: 'Complete and claim 10 quests',
      image: '',
      type: AchievementType.Milestone,
      eventType: AchievementEventType.QuestClaim,
      criteria: { targetCount: 10 },
      points: 5,
    });

    await seedQuest({
      userQuestStatus: UserQuestStatus.Completed,
      periodStart: new Date(now.getTime() - 60 * 60 * 1000),
      periodEnd: new Date(now.getTime() + 60 * 60 * 1000),
    });

    const res = await client.mutate(CLAIM_QUEST_REWARD_MUTATION, {
      variables: { userQuestId },
    });

    expect(res.errors).toBeUndefined();

    const userAchievement = await con
      .getRepository(UserAchievement)
      .findOneBy({ achievementId, userId: questUserId });

    expect(userAchievement).not.toBeNull();
    expect(userAchievement?.progress).toBe(1);
    expect(userAchievement?.unlockedAt).toBeNull();
  });

  it('should unlock achievement when target reached', async () => {
    const now = new Date();
    loggedUser = questUserId;

    const achievementId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    await con.getRepository(Achievement).save({
      id: achievementId,
      name: 'Quest enthusiast test',
      description: 'Complete and claim 1 quest',
      image: '',
      type: AchievementType.Milestone,
      eventType: AchievementEventType.QuestClaim,
      criteria: { targetCount: 1 },
      points: 5,
    });

    await seedQuest({
      userQuestStatus: UserQuestStatus.Completed,
      periodStart: new Date(now.getTime() - 60 * 60 * 1000),
      periodEnd: new Date(now.getTime() + 60 * 60 * 1000),
    });

    const res = await client.mutate(CLAIM_QUEST_REWARD_MUTATION, {
      variables: { userQuestId },
    });

    expect(res.errors).toBeUndefined();

    const userAchievement = await con
      .getRepository(UserAchievement)
      .findOneBy({ achievementId, userId: questUserId });

    expect(userAchievement).not.toBeNull();
    expect(userAchievement?.progress).toBeGreaterThanOrEqual(1);
    expect(userAchievement?.unlockedAt).not.toBeNull();
  });

  it('should accumulate progress across multiple claims', async () => {
    const now = new Date();
    loggedUser = questUserId;

    const achievementId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    await con.getRepository(Achievement).save({
      id: achievementId,
      name: 'Quest enthusiast test',
      description: 'Complete and claim 10 quests',
      image: '',
      type: AchievementType.Milestone,
      eventType: AchievementEventType.QuestClaim,
      criteria: { targetCount: 10 },
      points: 5,
    });

    const secondQuestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab';
    const secondRotationId = 'dddddddd-dddd-4ddd-8ddd-ddddddddddde';
    const secondUserQuestId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeed';

    await seedQuest({
      userQuestStatus: UserQuestStatus.Completed,
      periodStart: new Date(now.getTime() - 60 * 60 * 1000),
      periodEnd: new Date(now.getTime() + 60 * 60 * 1000),
    });

    await client.mutate(CLAIM_QUEST_REWARD_MUTATION, {
      variables: { userQuestId },
    });

    await saveFixtures(con, Quest, [
      {
        id: secondQuestId,
        name: 'Second quest',
        description: 'Write 2 comments',
        type: QuestType.Daily,
        eventType: QuestEventType.CommentCreate,
        criteria: { targetCount: 2 },
        active: true,
      },
    ]);

    await saveFixtures(con, QuestReward, [
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
        questId: secondQuestId,
        type: QuestRewardType.XP,
        amount: 10,
        metadata: {},
      },
    ]);

    await saveFixtures(con, QuestRotation, [
      {
        id: secondRotationId,
        questId: secondQuestId,
        type: QuestType.Daily,
        plusOnly: false,
        slot: 2,
        periodStart: new Date(now.getTime() - 60 * 60 * 1000),
        periodEnd: new Date(now.getTime() + 60 * 60 * 1000),
      },
    ]);

    await saveFixtures(con, UserQuest, [
      {
        id: secondUserQuestId,
        rotationId: secondRotationId,
        userId: questUserId,
        progress: 2,
        status: UserQuestStatus.Completed,
        completedAt: new Date(),
        claimedAt: null,
      },
    ]);

    const res = await client.mutate(CLAIM_QUEST_REWARD_MUTATION, {
      variables: { userQuestId: secondUserQuestId },
    });

    expect(res.errors).toBeUndefined();

    const userAchievement = await con
      .getRepository(UserAchievement)
      .findOneBy({ achievementId, userId: questUserId });

    expect(userAchievement).not.toBeNull();
    expect(userAchievement?.progress).toBe(2);
  });
});
