import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
  type GraphQLTestClient,
  type GraphQLTestingState,
} from './helpers';
import {
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

let app: FastifyInstance;
let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | null = null;
let isPlus = false;
const questUserId = '99999999-9999-4999-8999-999999999999';
const questId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const questRewardXpId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const questRewardReputationId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const questRotationId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const userQuestId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

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

beforeEach(() => {
  loggedUser = null;
  isPlus = false;
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
  await saveFixtures(con, User, [{ id: questUserId }]);

  await saveFixtures(con, Quest, [
    {
      id: questId,
      name: 'Hold my upvote',
      description: 'Upvote 5 posts',
      type: QuestType.Daily,
      plusOnly: false,
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
    {
      id: questRewardReputationId,
      questId,
      type: QuestRewardType.Reputation,
      amount: 20,
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

    expect(user.reputation).toBe(30);
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

    await testMutationErrorCode(
      client,
      {
        mutation: CLAIM_QUEST_REWARD_MUTATION,
        variables: {
          userQuestId,
        },
      },
      'BAD_USER_INPUT',
      'Quest is not completed yet',
    );
  });
});
