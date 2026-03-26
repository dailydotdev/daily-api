import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { UserFeedbackCategory } from '@dailydotdev/schema';
import createOrGetConnection from '../src/db';
import {
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  type GraphQLTestClient,
  type GraphQLTestingState,
} from './helpers';
import {
  Feedback,
  Post,
  PostType,
  Quest,
  QuestEventType,
  QuestReward,
  QuestRewardType,
  QuestRotation,
  QuestType,
  Source,
  User,
  View,
} from '../src/entity';
import {
  UserQuest,
  UserQuestProfile,
  UserQuestStatus,
} from '../src/entity/user';
import { HotTake } from '../src/entity/user/HotTake';
import appFunc from '../src';
import type { Context } from '../src/Context';
import { FastifyInstance } from 'fastify';
import { createSource } from './fixture/source';

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

const CLAIM_MILESTONE_QUEST_REWARD_MUTATION = `
mutation ClaimQuestReward($userQuestId: ID!) {
  claimQuestReward(userQuestId: $userQuestId) {
    level {
      totalXp
    }
    milestone {
      userQuestId
      status
      claimable
    }
  }
}
`;

const CLAIM_QUEST_REWARD_WITH_STREAKS_MUTATION = `
mutation ClaimQuestReward($userQuestId: ID!) {
  claimQuestReward(userQuestId: $userQuestId) {
    currentStreak
  }
}
`;

const QUEST_DASHBOARD_QUERY = `
query QuestDashboard {
  questDashboard {
    currentStreak
    longestStreak
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

const QUEST_STREAK_QUERY = `
query QuestDashboard {
  questDashboard {
    currentStreak
    longestStreak
  }
}
`;

const MILESTONE_QUEST_DASHBOARD_QUERY = `
query QuestDashboard {
  questDashboard {
    milestone {
      userQuestId
      progress
      status
      claimable
      quest {
        id
        name
        type
        targetCount
      }
      rewards {
        type
        amount
      }
    }
  }
}
`;

const TRACK_QUEST_EVENT_MUTATION = `
mutation TrackQuestEvent($eventType: ClientQuestEventType!) {
  trackQuestEvent(eventType: $eventType) {
    _
  }
}
`;

const ADD_HOT_TAKE_MUTATION = `
mutation AddHotTake($input: AddHotTakeInput!) {
  addHotTake(input: $input) {
    id
  }
}
`;

const SUBMIT_FEEDBACK_MUTATION = `
mutation SubmitFeedback($input: FeedbackInput!) {
  submitFeedback(input: $input) {
    _
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

  await con.createQueryBuilder().delete().from(UserQuest).execute();
  await con.createQueryBuilder().delete().from(UserQuestProfile).execute();
  await con.createQueryBuilder().delete().from(QuestRotation).execute();
  await con.createQueryBuilder().delete().from(QuestReward).execute();
  await con.createQueryBuilder().delete().from(Quest).execute();
  await con.createQueryBuilder().delete().from(Feedback).execute();
  await con.createQueryBuilder().delete().from(HotTake).execute();
  await con.getRepository(View).delete({ userId: questUserId });
  await con.getRepository(Post).delete({ authorId: questUserId });
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

const seedActiveQuest = async ({
  eventType,
  targetCount = 1,
  name = 'Quest under test',
  description = 'Quest under test',
}: {
  eventType: QuestEventType;
  targetCount?: number;
  name?: string;
  description?: string;
}) => {
  const seededQuestId = randomUUID();
  const seededRotationId = randomUUID();
  const now = new Date();

  await saveFixtures(con, Quest, [
    {
      id: seededQuestId,
      name,
      description,
      type: QuestType.Daily,
      eventType,
      criteria: {
        targetCount,
      },
      active: true,
    },
  ]);

  await saveFixtures(con, QuestRotation, [
    {
      id: seededRotationId,
      questId: seededQuestId,
      type: QuestType.Daily,
      plusOnly: false,
      slot: 1,
      periodStart: new Date(now.getTime() - 60 * 60 * 1000),
      periodEnd: new Date(now.getTime() + 60 * 60 * 1000),
    },
  ]);

  return {
    questId: seededQuestId,
    rotationId: seededRotationId,
  };
};

const getUtcDayStart = (date: Date = new Date()): Date =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

const seedQuestCompletionHistory = async (daysAgo: number[]) => {
  const today = getUtcDayStart();

  await saveFixtures(con, User, [{ id: questUserId }]);
  await saveFixtures(con, Quest, [
    {
      id: questId,
      name: 'Quest streak tester',
      description: 'Complete quests on consecutive days',
      type: QuestType.Daily,
      eventType: QuestEventType.PostUpvote,
      criteria: {
        targetCount: 1,
      },
      active: true,
    },
  ]);

  const rotationRows = daysAgo.map((day, index) => {
    const periodStart = new Date(today.getTime() - day * 24 * 60 * 60 * 1000);

    return {
      id: randomUUID(),
      questId,
      type: QuestType.Daily,
      plusOnly: false,
      slot: index + 1,
      periodStart,
      periodEnd: new Date(periodStart.getTime() + 24 * 60 * 60 * 1000),
    };
  });

  await saveFixtures(con, QuestRotation, rotationRows);
  await saveFixtures(
    con,
    UserQuest,
    rotationRows.map((rotation, index) => {
      const completedAt = new Date(
        rotation.periodStart.getTime() + 12 * 60 * 60 * 1000,
      );
      const isClaimed = index % 2 === 1;

      return {
        id: randomUUID(),
        rotationId: rotation.id,
        userId: questUserId,
        progress: 1,
        status: isClaimed ? UserQuestStatus.Claimed : UserQuestStatus.Completed,
        completedAt,
        claimedAt: isClaimed
          ? new Date(completedAt.getTime() + 5 * 60 * 1000)
          : null,
      };
    }),
  );
};

const seedHistoricalBriefReadMilestoneQuest = async () => {
  const milestoneQuestId = randomUUID();
  const milestoneRotationId = randomUUID();
  const briefPostIds = [
    'brief-milestone-1',
    'brief-milestone-2',
    'brief-milestone-3',
  ];
  const timestamps = [
    new Date('2026-03-20T08:00:00.000Z'),
    new Date('2026-03-21T08:00:00.000Z'),
    new Date('2026-03-22T08:00:00.000Z'),
  ];

  await saveFixtures(con, User, [{ id: questUserId, reputation: 10 }]);
  await saveFixtures(con, Source, [
    createSource('a', 'A', 'https://example.com/source-a.png'),
  ]);
  await saveFixtures(con, Quest, [
    {
      id: milestoneQuestId,
      name: 'Up to date',
      description: 'Read 3 articles',
      type: QuestType.Milestone,
      eventType: QuestEventType.BriefRead,
      criteria: {
        targetCount: 3,
      },
      active: true,
    },
  ]);
  await saveFixtures(con, QuestReward, [
    {
      id: randomUUID(),
      questId: milestoneQuestId,
      type: QuestRewardType.XP,
      amount: 1000,
      metadata: {},
    },
  ]);
  await saveFixtures(con, QuestRotation, [
    {
      id: milestoneRotationId,
      questId: milestoneQuestId,
      type: QuestType.Milestone,
      plusOnly: false,
      slot: 1,
      periodStart: new Date('2026-03-25T00:00:00.000Z'),
      periodEnd: new Date('9999-12-31T23:59:59.000Z'),
    },
  ]);
  await saveFixtures(con, Post, [
    {
      id: briefPostIds[0],
      shortId: 'brief-mile-001',
      title: 'Brief 1',
      url: 'https://example.com/brief-1',
      sourceId: 'a',
      authorId: questUserId,
      type: PostType.Brief,
      visible: true,
    },
    {
      id: briefPostIds[1],
      shortId: 'brief-mile-002',
      title: 'Brief 2',
      url: 'https://example.com/brief-2',
      sourceId: 'a',
      authorId: questUserId,
      type: PostType.Brief,
      visible: true,
    },
    {
      id: briefPostIds[2],
      shortId: 'brief-mile-003',
      title: 'Brief 3',
      url: 'https://example.com/brief-3',
      sourceId: 'a',
      authorId: questUserId,
      type: PostType.Brief,
      visible: true,
    },
  ]);
  await saveFixtures(con, View, [
    {
      postId: briefPostIds[0],
      userId: questUserId,
      timestamp: timestamps[0],
    },
    {
      postId: briefPostIds[1],
      userId: questUserId,
      timestamp: timestamps[1],
    },
    {
      postId: briefPostIds[2],
      userId: questUserId,
      timestamp: timestamps[2],
    },
  ]);

  return {
    milestoneQuestId,
    milestoneRotationId,
  };
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

  it('should not expose quest streaks on the claim payload', async () => {
    const res = await client.mutate(CLAIM_QUEST_REWARD_WITH_STREAKS_MUTATION, {
      variables: {
        userQuestId,
      },
    });

    expect(res.errors).toBeDefined();
    expect(res.errors?.[0]?.message).toContain(
      'Cannot query field "currentStreak"',
    );
    expect(res.errors?.[0]?.message).toContain('ClaimQuestRewardPayload');
  });

  it('should backfill milestone quests from historical brief reads on dashboard fetch', async () => {
    loggedUser = questUserId;

    const { milestoneQuestId, milestoneRotationId } =
      await seedHistoricalBriefReadMilestoneQuest();

    expect(
      await con.getRepository(UserQuest).findOneBy({
        userId: questUserId,
        rotationId: milestoneRotationId,
      }),
    ).toBeNull();

    const dashboardRes = await client.query(MILESTONE_QUEST_DASHBOARD_QUERY);

    expect(dashboardRes.errors).toBeUndefined();
    expect(dashboardRes.data.questDashboard.milestone).toHaveLength(1);

    const milestoneQuest = dashboardRes.data.questDashboard.milestone[0];

    expect(milestoneQuest).toMatchObject({
      progress: 3,
      status: UserQuestStatus.Completed,
      claimable: true,
      quest: {
        id: milestoneQuestId,
        name: 'Up to date',
        type: QuestType.Milestone,
        targetCount: 3,
      },
    });
    expect(milestoneQuest.userQuestId).toBeTruthy();
    expect(milestoneQuest.rewards).toEqual([
      {
        type: QuestRewardType.XP,
        amount: 1000,
      },
    ]);

    const storedMilestoneQuest = await con.getRepository(UserQuest).findOneBy({
      userId: questUserId,
      rotationId: milestoneRotationId,
    });

    expect(storedMilestoneQuest).toMatchObject({
      id: milestoneQuest.userQuestId,
      progress: 3,
      status: UserQuestStatus.Completed,
    });
    expect(storedMilestoneQuest?.completedAt).toBeTruthy();
  });

  it('should claim a backfilled milestone quest reward', async () => {
    loggedUser = questUserId;

    await seedHistoricalBriefReadMilestoneQuest();

    const dashboardRes = await client.query(MILESTONE_QUEST_DASHBOARD_QUERY);

    expect(dashboardRes.errors).toBeUndefined();

    const milestoneQuest = dashboardRes.data.questDashboard.milestone[0];

    const claimRes = await client.mutate(
      CLAIM_MILESTONE_QUEST_REWARD_MUTATION,
      {
        variables: {
          userQuestId: milestoneQuest.userQuestId,
        },
      },
    );

    expect(claimRes.errors).toBeUndefined();
    expect(claimRes.data.claimQuestReward.level.totalXp).toBe(1000);
    expect(claimRes.data.claimQuestReward.milestone).toEqual([
      {
        userQuestId: milestoneQuest.userQuestId,
        status: UserQuestStatus.Claimed,
        claimable: false,
      },
    ]);

    const profile = await con.getRepository(UserQuestProfile).findOneByOrFail({
      userId: questUserId,
    });

    expect(profile.totalXp).toBe(1000);
  });
});

describe('questDashboard query', () => {
  it('should return the current quest streak when consecutive quest days end yesterday', async () => {
    loggedUser = questUserId;

    await seedQuestCompletionHistory([1, 2, 3, 5]);

    const res = await client.query(QUEST_STREAK_QUERY);

    expect(res.errors).toBeUndefined();
    expect(res.data.questDashboard.currentStreak).toBe(3);
    expect(res.data.questDashboard.longestStreak).toBe(3);
  });

  it('should return zero when the user has no quest completion today or yesterday', async () => {
    loggedUser = questUserId;

    await seedQuestCompletionHistory([2, 3, 4]);

    const res = await client.query(QUEST_STREAK_QUERY);

    expect(res.errors).toBeUndefined();
    expect(res.data.questDashboard.currentStreak).toBe(0);
    expect(res.data.questDashboard.longestStreak).toBe(3);
  });
});

describe('quest progress hooks', () => {
  it.each([
    {
      eventType: QuestEventType.VisitArena,
      name: 'Arena scout',
      description: 'Visit the Arena',
    },
    {
      eventType: QuestEventType.VisitExplorePage,
      name: 'Exploration mode',
      description: 'Visit the Explore page',
    },
    {
      eventType: QuestEventType.VisitDiscussionsPage,
      name: 'Discussion diver',
      description: 'Visit the Discussions page',
    },
    {
      eventType: QuestEventType.VisitReadItLaterPage,
      name: 'Rainy day queue',
      description: 'Visit the Read it later page',
    },
  ])(
    'should complete %s client-side page visit quests',
    async ({ eventType, name, description }) => {
      loggedUser = questUserId;

      await saveFixtures(con, User, [{ id: questUserId }]);
      const { rotationId } = await seedActiveQuest({
        eventType,
        name,
        description,
      });

      const res = await client.mutate(TRACK_QUEST_EVENT_MUTATION, {
        variables: {
          eventType,
        },
      });

      expect(res.errors).toBeUndefined();

      const userQuest = await con.getRepository(UserQuest).findOneByOrFail({
        userId: questUserId,
        rotationId,
      });

      expect(userQuest).toMatchObject({
        progress: 1,
        status: UserQuestStatus.Completed,
      });
    },
  );

  it('should track client-side profile view quest progress', async () => {
    loggedUser = questUserId;

    await saveFixtures(con, User, [{ id: questUserId }]);
    const { rotationId } = await seedActiveQuest({
      eventType: QuestEventType.ViewUserProfile,
      targetCount: 3,
      name: 'People watcher',
      description: 'View 3 other user profiles',
    });

    await client.mutate(TRACK_QUEST_EVENT_MUTATION, {
      variables: {
        eventType: QuestEventType.ViewUserProfile,
      },
    });
    await client.mutate(TRACK_QUEST_EVENT_MUTATION, {
      variables: {
        eventType: QuestEventType.ViewUserProfile,
      },
    });
    const res = await client.mutate(TRACK_QUEST_EVENT_MUTATION, {
      variables: {
        eventType: QuestEventType.ViewUserProfile,
      },
    });

    expect(res.errors).toBeUndefined();

    const userQuest = await con.getRepository(UserQuest).findOneByOrFail({
      userId: questUserId,
      rotationId,
    });

    expect(userQuest).toMatchObject({
      progress: 3,
      status: UserQuestStatus.Completed,
    });
  });

  it('should complete hot take quests when creating a hot take', async () => {
    loggedUser = questUserId;

    await saveFixtures(con, User, [{ id: questUserId }]);
    const { rotationId } = await seedActiveQuest({
      eventType: QuestEventType.HotTakeCreate,
      name: 'Hot take mic check',
      description: 'Create a hot take',
    });

    const res = await client.mutate(ADD_HOT_TAKE_MUTATION, {
      variables: {
        input: {
          emoji: '🔥',
          title: 'Ship it',
        },
      },
    });

    expect(res.errors).toBeUndefined();

    const userQuest = await con.getRepository(UserQuest).findOneByOrFail({
      userId: questUserId,
      rotationId,
    });

    expect(userQuest).toMatchObject({
      progress: 1,
      status: UserQuestStatus.Completed,
    });
  });

  it('should complete feedback quests when submitting feedback', async () => {
    loggedUser = questUserId;

    await saveFixtures(con, User, [{ id: questUserId }]);
    const { rotationId } = await seedActiveQuest({
      eventType: QuestEventType.FeedbackSubmit,
      name: 'Feedback loop',
      description: 'Submit feedback',
    });

    const res = await client.mutate(SUBMIT_FEEDBACK_MUTATION, {
      variables: {
        input: {
          category: UserFeedbackCategory.BUG,
          description: 'Something feels off here',
        },
      },
    });

    expect(res.errors).toBeUndefined();

    const userQuest = await con.getRepository(UserQuest).findOneByOrFail({
      userId: questUserId,
      rotationId,
    });

    expect(userQuest).toMatchObject({
      progress: 1,
      status: UserQuestStatus.Completed,
    });
  });
});
