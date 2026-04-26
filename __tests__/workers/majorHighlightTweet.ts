import worker from '../../src/workers/majorHighlightTweet';
import { typedWorkers } from '../../src/workers';
import { PostHighlightSignificance } from '../../src/entity/PostHighlight';
import { expectSuccessfulTypedBackground } from '../helpers';

const mockCheckRedisObjectExists = jest.fn();
const mockSetRedisObjectIfNotExistsWithExpiry = jest.fn();
const mockSetRedisObjectWithExpiry = jest.fn();
const mockDeleteRedisKey = jest.fn();
const mockPostTweet = jest.fn();

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
    await expectSuccessfulTypedBackground<'api.v1.post-highlighted'>(worker, {
      highlightId: 'highlight-breaking',
      channel: 'ai',
      postId: 'post-breaking',
      headline: 'Breaking highlight headline',
      significance: PostHighlightSignificance.Breaking,
      highlightedAt: new Date().toISOString(),
    });

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
    await expectSuccessfulTypedBackground<'api.v1.post-highlighted'>(worker, {
      highlightId: 'highlight-major',
      channel: 'ai',
      postId: 'post-major',
      headline: 'Major highlight headline',
      significance: PostHighlightSignificance.Major,
      highlightedAt: new Date().toISOString(),
    });

    expect(mockPostTweet).toHaveBeenCalledWith({
      text: 'BREAKING: Major highlight headline',
    });
  });

  it('should skip non-major highlights', async () => {
    await expectSuccessfulTypedBackground<'api.v1.post-highlighted'>(worker, {
      highlightId: 'highlight-routine',
      channel: 'ai',
      postId: 'post-routine',
      headline: 'Routine highlight headline',
      significance: PostHighlightSignificance.Routine,
      highlightedAt: new Date().toISOString(),
    });

    expect(mockCheckRedisObjectExists).not.toHaveBeenCalled();
    expect(mockPostTweet).not.toHaveBeenCalled();
  });

  it('should skip duplicate events', async () => {
    mockCheckRedisObjectExists.mockResolvedValue(1);

    await expectSuccessfulTypedBackground<'api.v1.post-highlighted'>(worker, {
      highlightId: 'highlight-duplicate',
      channel: 'ai',
      postId: 'post-duplicate',
      headline: 'Duplicate highlight headline',
      significance: PostHighlightSignificance.Breaking,
      highlightedAt: new Date().toISOString(),
    });

    expect(mockSetRedisObjectIfNotExistsWithExpiry).not.toHaveBeenCalled();
    expect(mockPostTweet).not.toHaveBeenCalled();
  });

  it('should truncate long headlines to fit twitter limit', async () => {
    const headline = 'a'.repeat(400);

    await expectSuccessfulTypedBackground<'api.v1.post-highlighted'>(worker, {
      highlightId: 'highlight-long',
      channel: 'ai',
      postId: 'post-long',
      headline,
      significance: PostHighlightSignificance.Breaking,
      highlightedAt: new Date().toISOString(),
    });

    expect(mockPostTweet).toHaveBeenCalledWith({
      text: `BREAKING: ${'a'.repeat(267)}...`,
    });
  });

  it('should release lock when twitter publish fails', async () => {
    mockPostTweet.mockRejectedValue(new Error('twitter failed'));

    await expect(
      expectSuccessfulTypedBackground<'api.v1.post-highlighted'>(worker, {
        highlightId: 'highlight-error',
        channel: 'ai',
        postId: 'post-error',
        headline: 'Error highlight headline',
        significance: PostHighlightSignificance.Breaking,
        highlightedAt: new Date().toISOString(),
      }),
    ).rejects.toThrow('twitter failed');

    expect(mockDeleteRedisKey).toHaveBeenCalledWith(
      'major-highlight:tweet:lock:highlight-error',
    );
    expect(mockSetRedisObjectWithExpiry).not.toHaveBeenCalled();
  });
});
