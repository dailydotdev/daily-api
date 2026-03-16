jest.mock('../src/redis', () => ({
  redisPubSub: {
    asyncIterator: jest.fn(),
  },
}));

import { QUEST_ROTATION_UPDATE_CHANNEL } from '../src/common/quest';
import { redisPubSub } from '../src/redis';
import { resolvers } from '../src/schema/quests';

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
