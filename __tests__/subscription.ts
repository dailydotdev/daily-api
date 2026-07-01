jest.mock('../src/redis', () => ({
  redisPubSub: {
    asyncIterator: jest.fn(),
  },
}));

import { CONTRIBUTION_ACTION_COMPLETED_CHANNEL } from '../src/common/contribution';
import { NEW_HIGHLIGHT_CHANNEL } from '../src/common/highlights';
import { QUEST_ROTATION_UPDATE_CHANNEL } from '../src/common/quest';
import { redisPubSub } from '../src/redis';
import {
  resolvers as highlightResolvers,
  typeDefs as highlightTypeDefs,
} from '../src/schema/highlights';
import { resolvers } from '../src/schema/quests';
import {
  resolvers as contributionResolvers,
  typeDefs as contributionTypeDefs,
} from '../src/schema/contributions';

describe('quest subscriptions', () => {
  const iterator = {
    next: jest.fn(),
    return: jest.fn(),
    throw: jest.fn(),
  };

  const subscriptionResolvers = resolvers.Subscription as Record<
    string,
    {
      subscribe: (
        source: unknown,
        args: unknown,
        ctx: unknown,
      ) => Promise<unknown>;
    }
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(redisPubSub.asyncIterator).mockReturnValue(iterator as never);
  });

  it('should allow questUpdate subscriptions without a user id', async () => {
    await expect(
      subscriptionResolvers.questUpdate.subscribe(null, null, {}),
    ).resolves.toBeDefined();

    expect(redisPubSub.asyncIterator).toHaveBeenCalledWith(
      'events.quests.undefined.update',
    );
  });

  it('should allow questRotationUpdate subscriptions without a user id', async () => {
    await expect(
      subscriptionResolvers.questRotationUpdate.subscribe(null, null, {}),
    ).resolves.toBeDefined();

    expect(redisPubSub.asyncIterator).toHaveBeenCalledWith(
      QUEST_ROTATION_UPDATE_CHANNEL,
    );
  });
});

describe('highlight subscriptions', () => {
  const iterator = {
    next: jest.fn(),
    return: jest.fn(),
    throw: jest.fn(),
  };

  const subscriptionResolvers = highlightResolvers.Subscription as Record<
    string,
    {
      subscribe: (
        source: unknown,
        args: unknown,
        ctx: unknown,
      ) => Promise<unknown>;
    }
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(redisPubSub.asyncIterator).mockReturnValue(iterator as never);
  });

  it('should require auth in the schema for newHighlight', () => {
    expect(highlightTypeDefs).toContain('newHighlight: PostHighlight! @auth');
  });

  it('should subscribe newHighlight to the highlight broadcast channel', async () => {
    await expect(
      subscriptionResolvers.newHighlight.subscribe(null, null, {
        userId: '1',
      }),
    ).resolves.toBeDefined();

    expect(redisPubSub.asyncIterator).toHaveBeenCalledWith(
      NEW_HIGHLIGHT_CHANNEL,
    );
  });
});

describe('contribution subscriptions', () => {
  const iterator = {
    next: jest.fn(),
    return: jest.fn(),
    throw: jest.fn(),
  };

  const subscriptionResolvers = contributionResolvers.Subscription as Record<
    string,
    {
      subscribe: (
        source: unknown,
        args: unknown,
        ctx: unknown,
      ) => Promise<AsyncIterable<unknown>>;
    }
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(redisPubSub.asyncIterator).mockReturnValue(iterator as never);
  });

  it('should require auth in the schema for contributionActionCompleted', () => {
    expect(contributionTypeDefs).toContain(
      'contributionActionCompleted: ContributionActionCompleted! @auth',
    );
  });

  it('should subscribe to the global completion channel', async () => {
    await expect(
      subscriptionResolvers.contributionActionCompleted.subscribe(
        null,
        null,
        {},
      ),
    ).resolves.toBeDefined();

    expect(redisPubSub.asyncIterator).toHaveBeenCalledWith(
      CONTRIBUTION_ACTION_COMPLETED_CHANNEL,
    );
  });

  it('should wrap published events under the subscription field', async () => {
    const payload = {
      submissionId: 'sub-1',
      userId: '1',
      actionId: 'action-1',
      awardedPoints: 50,
    };
    iterator.next.mockResolvedValueOnce({ done: false, value: payload });

    const asyncIterable =
      await subscriptionResolvers.contributionActionCompleted.subscribe(
        null,
        null,
        { userId: '1' },
      );
    const result = await asyncIterable[Symbol.asyncIterator]().next();

    expect(result).toEqual({
      done: false,
      value: { contributionActionCompleted: payload },
    });
  });
});
