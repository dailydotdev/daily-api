import { PubSub } from '@google-cloud/pubsub';
import { type DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import worker from '../../src/workers/majorHighlightTweet';
import { typedWorkers } from '../../src/workers';
import { PostHighlightSignificance } from '../../src/entity/PostHighlight';
import { createMockLogger, expectSuccessfulTypedBackground } from '../helpers';

const mockPostTweet = jest.fn();
let con: DataSource;

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
  highlightId: 'highlight-id',
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

describe('majorHighlightTweet worker', () => {
  beforeAll(async () => {
    con = await createOrGetConnection();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockPostTweet.mockResolvedValue('tweet-id');
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
        highlightId: 'highlight-breaking',
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
        highlightId: 'highlight-major',
        postId: 'post-major',
        headline: 'Major highlight headline',
        significance: PostHighlightSignificance.Major,
      }),
    );

    expect(mockPostTweet).toHaveBeenCalledWith({
      text: 'BREAKING: Major highlight headline',
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
            highlightId: 'highlight-error',
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
        highlightId: 'highlight-error',
        messageId: 'msg',
        err: expect.any(Error),
      },
      'failed to publish major highlight tweet',
    );
  });
});
