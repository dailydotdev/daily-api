import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { UserFeedbackCategory } from '@dailydotdev/schema';
import createOrGetConnection from '../src/db';
import {
  createMockLogger,
  expectSuccessfulBackground,
  initializeGraphQLTesting,
  mockChangeMessage,
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
import { assignIntroQuestsToUser } from '../src/common/quest/intro';
import { checkQuestProgress } from '../src/common/quest/progress';
import { UserActionType } from '../src/entity/user/UserAction';
import { UserExperience } from '../src/entity/user/experiences/UserExperience';
import { UserExperienceType } from '../src/entity/user/experiences/types';
import cdcWorker from '../src/workers/cdc/primary';
import type { ChangeObject } from '../src/types';

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
    hasNewQuestRotations
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

const QUEST_NEW_ROTATIONS_QUERY = `
query QuestDashboard {
  questDashboard {
    hasNewQuestRotations
  }
}
`;

const MARK_QUEST_ROTATIONS_VIEWED_MUTATION = `
mutation MarkQuestRotationsViewed {
  markQuestRotationsViewed {
    _
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
  it('should expose when there are unseen active quest rotations', async () => {
    const now = new Date();
    loggedUser = questUserId;

    await saveFixtures(con, User, [{ id: questUserId }]);
    await saveFixtures(con, Quest, [
      {
        id: questId,
        name: 'Fresh quest',
        description: 'New quest',
        type: QuestType.Daily,
        eventType: QuestEventType.PostUpvote,
        criteria: {
          targetCount: 1,
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
    ]);

    const res = await client.query(QUEST_NEW_ROTATIONS_QUERY);

    expect(res.errors).toBeUndefined();
    expect(res.data.questDashboard.hasNewQuestRotations).toBe(true);
  });

  it('should clear new quest rotations after marking them viewed', async () => {
    const now = new Date();
    loggedUser = questUserId;

    await saveFixtures(con, User, [{ id: questUserId }]);
    await saveFixtures(con, Quest, [
      {
        id: questId,
        name: 'Fresh quest',
        description: 'New quest',
        type: QuestType.Daily,
        eventType: QuestEventType.PostUpvote,
        criteria: {
          targetCount: 1,
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
    ]);

    const markRes = await client.mutate(MARK_QUEST_ROTATIONS_VIEWED_MUTATION);

    expect(markRes.errors).toBeUndefined();
    expect(markRes.data.markQuestRotationsViewed._).toBe(true);

    const dashboardRes = await client.query(QUEST_NEW_ROTATIONS_QUERY);

    expect(dashboardRes.errors).toBeUndefined();
    expect(dashboardRes.data.questDashboard.hasNewQuestRotations).toBe(false);

    const profile = await con
      .getRepository(UserQuestProfile)
      .findOneByOrFail({ userId: questUserId });

    expect(profile.lastViewedQuestRotationsAt).toBeTruthy();
  });

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

describe('intro quests', () => {
  const seedIntroQuests = async () => {
    const introQuestId = randomUUID();
    const introRotationId = randomUUID();

    await saveFixtures(con, User, [{ id: questUserId }]);
    await saveFixtures(con, Quest, [
      {
        id: introQuestId,
        name: 'Install the browser extension',
        description:
          'Pin daily.dev to your browser so the feed is always one click away.',
        type: QuestType.Intro,
        eventType: QuestEventType.ExtensionInstall,
        criteria: {
          targetCount: 1,
        },
        active: true,
      },
    ]);
    await saveFixtures(con, QuestReward, [
      {
        id: randomUUID(),
        questId: introQuestId,
        type: QuestRewardType.XP,
        amount: 10,
        metadata: {},
      },
    ]);
    await saveFixtures(con, QuestRotation, [
      {
        id: introRotationId,
        questId: introQuestId,
        type: QuestType.Intro,
        plusOnly: false,
        slot: 1,
        periodStart: new Date('2026-03-25T00:00:00.000Z'),
        periodEnd: new Date('9999-12-31T23:59:59.000Z'),
      },
    ]);

    return { introQuestId, introRotationId };
  };

  it('should insert one UserQuest per active intro rotation', async () => {
    const { introRotationId } = await seedIntroQuests();

    await assignIntroQuestsToUser({ con, userId: questUserId });

    const userQuests = await con.getRepository(UserQuest).find({
      where: { userId: questUserId },
    });

    expect(userQuests).toHaveLength(1);
    expect(userQuests[0]).toMatchObject({
      rotationId: introRotationId,
      userId: questUserId,
      progress: 0,
      status: UserQuestStatus.InProgress,
      completedAt: null,
      claimedAt: null,
    });
  });

  it('should be idempotent on repeat calls', async () => {
    await seedIntroQuests();

    await assignIntroQuestsToUser({ con, userId: questUserId });
    await assignIntroQuestsToUser({ con, userId: questUserId });

    const userQuests = await con.getRepository(UserQuest).find({
      where: { userId: questUserId },
    });

    expect(userQuests).toHaveLength(1);
  });

  it('should skip rotations outside the active period', async () => {
    await saveFixtures(con, User, [{ id: questUserId }]);
    const futureQuestId = randomUUID();
    const futureRotationId = randomUUID();

    await saveFixtures(con, Quest, [
      {
        id: futureQuestId,
        name: 'Future intro',
        description: 'Not yet active',
        type: QuestType.Intro,
        eventType: QuestEventType.ExtensionInstall,
        criteria: { targetCount: 1 },
        active: true,
      },
    ]);
    await saveFixtures(con, QuestRotation, [
      {
        id: futureRotationId,
        questId: futureQuestId,
        type: QuestType.Intro,
        plusOnly: false,
        slot: 1,
        periodStart: new Date('9999-01-01T00:00:00.000Z'),
        periodEnd: new Date('9999-12-31T23:59:59.000Z'),
      },
    ]);

    await assignIntroQuestsToUser({ con, userId: questUserId });

    const userQuests = await con.getRepository(UserQuest).find({
      where: { userId: questUserId },
    });

    expect(userQuests).toHaveLength(0);
  });

  it('should expose intro quests in questDashboard', async () => {
    loggedUser = questUserId;
    const { introQuestId, introRotationId } = await seedIntroQuests();

    await assignIntroQuestsToUser({ con, userId: questUserId });

    const res = await client.query(`
      query QuestDashboard {
        questDashboard {
          intro {
            rotationId
            progress
            status
            quest {
              id
              name
              type
            }
          }
        }
      }
    `);

    expect(res.errors).toBeUndefined();
    expect(res.data.questDashboard.intro).toEqual([
      {
        rotationId: introRotationId,
        progress: 0,
        status: UserQuestStatus.InProgress,
        quest: {
          id: introQuestId,
          name: 'Install the browser extension',
          type: QuestType.Intro,
        },
      },
    ]);
  });

  it('should return an empty intro array for users with no intro UserQuests', async () => {
    loggedUser = questUserId;
    await seedIntroQuests();
    await saveFixtures(con, User, [{ id: questUserId }]);

    const res = await client.query(`
      query QuestDashboard {
        questDashboard {
          intro {
            rotationId
          }
        }
      }
    `);

    expect(res.errors).toBeUndefined();
    expect(res.data.questDashboard.intro).toEqual([]);
  });

  const seedBriefIntroQuest = async () => {
    const introQuestId = randomUUID();
    const introRotationId = randomUUID();

    await saveFixtures(con, User, [{ id: questUserId }]);
    await saveFixtures(con, Quest, [
      {
        id: introQuestId,
        name: 'Generate your first brief',
        description: 'Spin up a quick daily briefing.',
        type: QuestType.Intro,
        eventType: QuestEventType.BriefGenerate,
        criteria: { targetCount: 1 },
        active: true,
      },
    ]);
    await saveFixtures(con, QuestRotation, [
      {
        id: introRotationId,
        questId: introQuestId,
        type: QuestType.Intro,
        plusOnly: false,
        slot: 1,
        periodStart: new Date('2026-03-25T00:00:00.000Z'),
        periodEnd: new Date('9999-12-31T23:59:59.000Z'),
      },
    ]);

    return { introQuestId, introRotationId };
  };

  it('should complete an existing intro UserQuest when its event fires', async () => {
    const { introRotationId } = await seedBriefIntroQuest();
    await assignIntroQuestsToUser({ con, userId: questUserId });

    const didUpdate = await checkQuestProgress({
      con: con.manager,
      logger: createMockLogger(),
      userId: questUserId,
      eventType: QuestEventType.BriefGenerate,
    });

    expect(didUpdate).toBe(true);

    const userQuest = await con.getRepository(UserQuest).findOneByOrFail({
      userId: questUserId,
      rotationId: introRotationId,
    });

    expect(userQuest).toMatchObject({
      progress: 1,
      status: UserQuestStatus.Completed,
    });
    expect(userQuest.completedAt).not.toBeNull();
  });

  it('should not create a UserQuest for users without one when an intro event fires', async () => {
    await seedBriefIntroQuest();

    const didUpdate = await checkQuestProgress({
      con: con.manager,
      logger: createMockLogger(),
      userId: questUserId,
      eventType: QuestEventType.BriefGenerate,
    });

    expect(didUpdate).toBe(false);

    const userQuests = await con.getRepository(UserQuest).find({
      where: { userId: questUserId },
    });

    expect(userQuests).toHaveLength(0);
  });

  it('should be a no-op once the intro quest is completed', async () => {
    const { introRotationId } = await seedBriefIntroQuest();
    await assignIntroQuestsToUser({ con, userId: questUserId });

    await checkQuestProgress({
      con: con.manager,
      logger: createMockLogger(),
      userId: questUserId,
      eventType: QuestEventType.BriefGenerate,
    });

    const didUpdate = await checkQuestProgress({
      con: con.manager,
      logger: createMockLogger(),
      userId: questUserId,
      eventType: QuestEventType.BriefGenerate,
    });

    expect(didUpdate).toBe(false);

    const userQuest = await con.getRepository(UserQuest).findOneByOrFail({
      userId: questUserId,
      rotationId: introRotationId,
    });

    expect(userQuest.progress).toBe(1);
  });

  const seedNotificationsIntroQuest = async () => {
    const introQuestId = randomUUID();
    const introRotationId = randomUUID();

    await saveFixtures(con, User, [{ id: questUserId }]);
    await saveFixtures(con, Quest, [
      {
        id: introQuestId,
        name: 'Turn on notifications',
        description: 'Enable alerts.',
        type: QuestType.Intro,
        eventType: QuestEventType.NotificationsEnable,
        criteria: { targetCount: 1 },
        active: true,
      },
    ]);
    await saveFixtures(con, QuestRotation, [
      {
        id: introRotationId,
        questId: introQuestId,
        type: QuestType.Intro,
        plusOnly: false,
        slot: 1,
        periodStart: new Date('2026-03-25T00:00:00.000Z'),
        periodEnd: new Date('9999-12-31T23:59:59.000Z'),
      },
    ]);

    return { introQuestId, introRotationId };
  };

  it('should complete the notifications intro quest via completeAction', async () => {
    loggedUser = questUserId;
    const { introRotationId } = await seedNotificationsIntroQuest();
    await assignIntroQuestsToUser({ con, userId: questUserId });

    const res = await client.mutate(
      `mutation CompleteAction($type: String!) {
        completeAction(type: $type) { _ }
      }`,
      { variables: { type: UserActionType.EnableNotification } },
    );

    expect(res.errors).toBeUndefined();

    const userQuest = await con.getRepository(UserQuest).findOneByOrFail({
      userId: questUserId,
      rotationId: introRotationId,
    });

    expect(userQuest).toMatchObject({
      progress: 1,
      status: UserQuestStatus.Completed,
    });
  });

  const seedProfileCompleteIntroQuest = async () => {
    const introQuestId = randomUUID();
    const introRotationId = randomUUID();

    await saveFixtures(con, Quest, [
      {
        id: introQuestId,
        name: 'Complete your profile',
        description: 'Add enough context.',
        type: QuestType.Intro,
        eventType: QuestEventType.ProfileComplete,
        criteria: { targetCount: 1 },
        active: true,
      },
    ]);
    await saveFixtures(con, QuestRotation, [
      {
        id: introRotationId,
        questId: introQuestId,
        type: QuestType.Intro,
        plusOnly: false,
        slot: 1,
        periodStart: new Date('2026-03-25T00:00:00.000Z'),
        periodEnd: new Date('9999-12-31T23:59:59.000Z'),
      },
    ]);

    return { introQuestId, introRotationId };
  };

  const createCompleteUser = () => ({
    id: questUserId,
    image: 'https://example.com/avatar.png',
    bio: 'Building things.',
    experienceLevel: 'MORE_THAN_2_YEARS',
  });

  const completeUser = createCompleteUser();

  const toUserChangeObject = (user: Partial<User>): ChangeObject<User> =>
    ({
      ...user,
      flags: JSON.stringify(user.flags ?? {}),
      notificationFlags: JSON.stringify(user.notificationFlags ?? {}),
      subscriptionFlags: JSON.stringify(user.subscriptionFlags ?? {}),
    }) as ChangeObject<User>;

  const seedProfileCompleteFixtures = async (
    user: Partial<typeof completeUser> = completeUser,
  ) => {
    await saveFixtures(con, User, [{ id: questUserId, ...user }]);
    await saveFixtures(con, UserExperience, [
      {
        userId: questUserId,
        title: 'Engineer',
        startedAt: new Date('2022-01-01'),
        endedAt: null,
        type: UserExperienceType.Work,
      },
      {
        userId: questUserId,
        title: 'CS Degree',
        startedAt: new Date('2018-01-01'),
        endedAt: new Date('2022-01-01'),
        type: UserExperienceType.Education,
      },
    ]);
    const { introRotationId } = await seedProfileCompleteIntroQuest();
    await assignIntroQuestsToUser({ con, userId: questUserId });
    return { introRotationId };
  };

  it('should complete the profile intro quest when a User update lands at 100%', async () => {
    const { introRotationId } = await seedProfileCompleteFixtures();
    const completeUserChange = toUserChangeObject(createCompleteUser());

    await expectSuccessfulBackground(
      cdcWorker,
      mockChangeMessage({
        after: completeUserChange,
        before: completeUserChange,
        table: 'user',
        op: 'u',
      }),
    );

    const userQuest = await con.getRepository(UserQuest).findOneByOrFail({
      userId: questUserId,
      rotationId: introRotationId,
    });

    expect(userQuest).toMatchObject({
      progress: 1,
      status: UserQuestStatus.Completed,
    });
  });

  it('should complete the profile intro quest when a UserExperience insert (e.g. CV import) brings the user to 100%', async () => {
    await saveFixtures(con, User, [{ ...completeUser }]);
    await saveFixtures(con, UserExperience, [
      {
        userId: questUserId,
        title: 'Engineer',
        startedAt: new Date('2022-01-01'),
        endedAt: null,
        type: UserExperienceType.Work,
      },
    ]);
    const { introRotationId } = await seedProfileCompleteIntroQuest();
    await assignIntroQuestsToUser({ con, userId: questUserId });

    const insertedEducation = await con.getRepository(UserExperience).save({
      userId: questUserId,
      title: 'CS Degree',
      startedAt: new Date('2018-01-01'),
      endedAt: new Date('2022-01-01'),
      type: UserExperienceType.Education,
    });

    await expectSuccessfulBackground(
      cdcWorker,
      mockChangeMessage({
        after: {
          id: insertedEducation.id,
          userId: questUserId,
          type: UserExperienceType.Education,
        } as ChangeObject<UserExperience>,
        table: 'user_experience',
        op: 'c',
      }),
    );

    const userQuest = await con.getRepository(UserQuest).findOneByOrFail({
      userId: questUserId,
      rotationId: introRotationId,
    });

    expect(userQuest).toMatchObject({
      progress: 1,
      status: UserQuestStatus.Completed,
    });
  });

  it('should not progress the profile intro quest when profile is incomplete', async () => {
    const incompleteUser = {
      ...createCompleteUser(),
      experienceLevel: null,
    };
    const { introRotationId } =
      await seedProfileCompleteFixtures(incompleteUser);
    const incompleteUserChange = toUserChangeObject(incompleteUser);

    await expectSuccessfulBackground(
      cdcWorker,
      mockChangeMessage({
        after: incompleteUserChange,
        before: incompleteUserChange,
        table: 'user',
        op: 'u',
      }),
    );

    const userQuest = await con.getRepository(UserQuest).findOneByOrFail({
      userId: questUserId,
      rotationId: introRotationId,
    });

    expect(userQuest).toMatchObject({
      progress: 0,
      status: UserQuestStatus.InProgress,
    });
  });
});
