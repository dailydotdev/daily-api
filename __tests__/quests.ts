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
  Quest,
  QuestEventType,
  QuestReward,
  QuestRewardType,
  QuestRotation,
  QuestType,
  User,
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
