import { PubSub } from '@google-cloud/pubsub';
import { type DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  deleteKeysByPattern,
  ioRedisPool,
  redisPubSub,
  singleRedisClient,
} from '../../src/redis';
import worker from '../../src/workers/majorHighlightTweet';
import { typedWorkers } from '../../src/workers';
import { PostHighlightSignificance } from '../../src/entity/PostHighlight';
import { createMockLogger, expectSuccessfulTypedBackground } from '../helpers';

const mockPostTweet = jest.fn();
let con: DataSource;
const clearMajorHighlightTweetLocks = () =>
  deleteKeysByPattern('major-highlight:tweet:*');

const createEvent = (
  overrides: Partial<{
    highlightId: string;
    channel: string;
    postId: string;
    headline: string;
    significance: PostHighlightSignificance;
    highlightedAt: string;
  }> = {},
) => ({
  highlightId: 'c',
  channel: 'ai',
  postId: 'post-id',
  headline: 'Highlight headline',
  significance: PostHighlightSignificance.Breaking,
  highlightedAt: new Date().toISOString(),
  ...overrides,
});

jest.mock('../../src/integrations/twitter/clients', () => ({
  getTwitterClient: () => ({
    postTweet: (...args: unknown[]) => mockPostTweet(...args),
  }),
}));

jest.setTimeout(30000);

describe('majorHighlightTweet worker', () => {
  beforeAll(async () => {
    con = await createOrGetConnection();
  });

  afterAll(async () => {
    if (con?.isInitialized) {
      await con.destroy();
    }

    singleRedisClient.disconnect();
    redisPubSub.getPublisher().disconnect();
    redisPubSub.getSubscriber().disconnect();
    await redisPubSub.close();
    await ioRedisPool.end();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockPostTweet.mockResolvedValue('tweet-id');
    return clearMajorHighlightTweetLocks();
  });

  afterEach(async () => {
    await clearMajorHighlightTweetLocks();
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should publish tweet for breaking highlights', async () => {
    await expectSuccessfulTypedBackground<'api.v1.post-highlighted'>(
      worker,
      createEvent({
        highlightId: 'c',
        postId: 'post-breaking',
        headline: 'Breaking highlight headline',
      }),
    );

    expect(mockPostTweet).toHaveBeenCalledWith({
      text: 'BREAKING: Breaking highlight headline',
    });
  });

  it('should publish tweet for major highlights', async () => {
    await expectSuccessfulTypedBackground<'api.v1.post-highlighted'>(
      worker,
      createEvent({
        highlightId: 'c',
        postId: 'post-major',
        headline: 'Major highlight headline',
        significance: PostHighlightSignificance.Major,
      }),
    );

    expect(mockPostTweet).toHaveBeenCalledWith({
      text: 'JUST IN: Major highlight headline',
    });
  });

  it('should vary the prefix within the configured breaking options', async () => {
    await expectSuccessfulTypedBackground<'api.v1.post-highlighted'>(
      worker,
      createEvent({
        highlightId: 'b',
        postId: 'post-breaking-variant',
        headline: 'Breaking variant headline',
      }),
    );

    expect(mockPostTweet).toHaveBeenCalledWith({
      text: 'FLASH: Breaking variant headline',
    });
  });

  it('should publish only one tweet for multiple highlights on the same post', async () => {
    const postId = 'post-dedup';

    await expectSuccessfulTypedBackground<'api.v1.post-highlighted'>(
      worker,
      createEvent({
        highlightId: 'c',
        postId,
        headline: 'First highlight headline',
      }),
    );

    await expectSuccessfulTypedBackground<'api.v1.post-highlighted'>(
      worker,
      createEvent({
        highlightId: 'highlight-dedup-2',
        channel: 'opensource',
        postId,
        headline: 'Second highlight headline',
      }),
    );

    expect(mockPostTweet).toHaveBeenCalledTimes(1);
    expect(mockPostTweet).toHaveBeenCalledWith({
      text: 'BREAKING: First highlight headline',
    });
  });

  it('should skip reprocessing the same highlight', async () => {
    const event = createEvent({
      highlightId: 'c',
      postId: 'post-retry',
      headline: 'Retry highlight headline',
    });

    await expectSuccessfulTypedBackground<'api.v1.post-highlighted'>(
      worker,
      event,
    );
    await expectSuccessfulTypedBackground<'api.v1.post-highlighted'>(
      worker,
      event,
    );

    expect(mockPostTweet).toHaveBeenCalledTimes(1);
    expect(mockPostTweet).toHaveBeenCalledWith({
      text: 'BREAKING: Retry highlight headline',
    });
  });

  it('should skip non-major highlights', async () => {
    await expectSuccessfulTypedBackground<'api.v1.post-highlighted'>(
      worker,
      createEvent({
        highlightId: 'highlight-routine',
        postId: 'post-routine',
        headline: 'Routine highlight headline',
        significance: PostHighlightSignificance.Routine,
      }),
    );

    expect(mockPostTweet).not.toHaveBeenCalled();
  });

  it('should publish the full headline without trimming or truncating', async () => {
    await expectSuccessfulTypedBackground<'api.v1.post-highlighted'>(
      worker,
      createEvent({
        highlightId: 'c',
        headline: `  ${'a'.repeat(400)}  `,
      }),
    );

    expect(mockPostTweet).toHaveBeenCalledWith({
      text: `BREAKING:   ${'a'.repeat(400)}  `,
    });
  });

  it('should release lock when twitter publish fails', async () => {
    mockPostTweet.mockRejectedValue(new Error('twitter failed'));
    const logger = createMockLogger();

    await expect(
      worker.handler(
        {
          messageId: 'msg',
          data: createEvent({
            highlightId: 'c',
            postId: 'post-error',
            headline: 'Error highlight headline',
          }),
        },
        con,
        logger,
        new PubSub(),
      ),
    ).rejects.toThrow('twitter failed');

    expect(logger.error).toHaveBeenCalledWith(
      {
        highlightId: 'c',
        postId: 'post-error',
        messageId: 'msg',
        err: expect.any(Error),
      },
      'failed to publish major highlight tweet',
    );
  });
});
