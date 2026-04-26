import worker from '../../src/workers/majorHighlightTweet';
import { typedWorkers } from '../../src/workers';
import { PostHighlightSignificance } from '../../src/entity/PostHighlight';
import { expectSuccessfulTypedBackground } from '../helpers';

const mockCheckRedisObjectExists = jest.fn();
const mockSetRedisObjectIfNotExistsWithExpiry = jest.fn();
const mockSetRedisObjectWithExpiry = jest.fn();
const mockDeleteRedisKey = jest.fn();
const mockPostTweet = jest.fn();

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

jest.mock('../../src/redis', () => ({
  ...jest.requireActual<Record<string, unknown>>('../../src/redis'),
  checkRedisObjectExists: (...args: unknown[]) =>
    mockCheckRedisObjectExists(...args),
  setRedisObjectIfNotExistsWithExpiry: (...args: unknown[]) =>
    mockSetRedisObjectIfNotExistsWithExpiry(...args),
  setRedisObjectWithExpiry: (...args: unknown[]) =>
    mockSetRedisObjectWithExpiry(...args),
  deleteRedisKey: (...args: unknown[]) => mockDeleteRedisKey(...args),
}));

jest.mock('../../src/integrations/twitter/clients', () => ({
  getTwitterClient: () => ({
    postTweet: (...args: unknown[]) => mockPostTweet(...args),
  }),
}));

describe('majorHighlightTweet worker', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockCheckRedisObjectExists.mockResolvedValue(0);
    mockSetRedisObjectIfNotExistsWithExpiry.mockResolvedValue(true);
    mockSetRedisObjectWithExpiry.mockResolvedValue('OK');
    mockDeleteRedisKey.mockResolvedValue(1);
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
    expect(mockSetRedisObjectWithExpiry).toHaveBeenCalledWith(
      'major-highlight:tweet:done:highlight-breaking',
      '1',
      604800,
    );
    expect(mockDeleteRedisKey).toHaveBeenCalledWith(
      'major-highlight:tweet:lock:highlight-breaking',
    );
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

  it('should trim the headline before tweeting', async () => {
    await expectSuccessfulTypedBackground<'api.v1.post-highlighted'>(
      worker,
      createEvent({
        headline: '  Trimmed highlight headline  ',
      }),
    );

    expect(mockPostTweet).toHaveBeenCalledWith({
      text: 'BREAKING: Trimmed highlight headline',
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

    expect(mockCheckRedisObjectExists).not.toHaveBeenCalled();
    expect(mockPostTweet).not.toHaveBeenCalled();
  });

  it('should skip blank headlines', async () => {
    await expectSuccessfulTypedBackground<'api.v1.post-highlighted'>(
      worker,
      createEvent({
        headline: '   ',
      }),
    );

    expect(mockCheckRedisObjectExists).not.toHaveBeenCalled();
    expect(mockPostTweet).not.toHaveBeenCalled();
  });

  it('should skip duplicate events', async () => {
    mockCheckRedisObjectExists.mockResolvedValue(1);

    await expectSuccessfulTypedBackground<'api.v1.post-highlighted'>(
      worker,
      createEvent({
        highlightId: 'highlight-duplicate',
        postId: 'post-duplicate',
        headline: 'Duplicate highlight headline',
      }),
    );

    expect(mockSetRedisObjectIfNotExistsWithExpiry).not.toHaveBeenCalled();
    expect(mockPostTweet).not.toHaveBeenCalled();
  });

  it('should truncate long headlines to fit twitter limit', async () => {
    await expectSuccessfulTypedBackground<'api.v1.post-highlighted'>(
      worker,
      createEvent({
        highlightId: 'highlight-long',
        postId: 'post-long',
        headline: 'a'.repeat(400),
      }),
    );

    expect(mockPostTweet).toHaveBeenCalledWith({
      text: `BREAKING: ${'a'.repeat(267)}...`,
    });
  });

  it('should release lock when twitter publish fails', async () => {
    mockPostTweet.mockRejectedValue(new Error('twitter failed'));

    await expect(
      expectSuccessfulTypedBackground<'api.v1.post-highlighted'>(
        worker,
        createEvent({
          highlightId: 'highlight-error',
          postId: 'post-error',
          headline: 'Error highlight headline',
        }),
      ),
    ).rejects.toThrow('twitter failed');

    expect(mockDeleteRedisKey).toHaveBeenCalledWith(
      'major-highlight:tweet:lock:highlight-error',
    );
    expect(mockSetRedisObjectWithExpiry).not.toHaveBeenCalled();
  });
});
