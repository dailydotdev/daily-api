import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  AGENTS_DIGEST_SOURCE,
  Source,
  SourceType,
} from '../../src/entity/Source';
import { FreeformPost } from '../../src/entity/posts/FreeformPost';
import { PostType } from '../../src/entity/posts/Post';
import worker from '../../src/workers/agenticDigestTweet';
import { typedWorkers } from '../../src/workers';
import { expectSuccessfulTypedBackground } from '../helpers';

const mockCheckRedisObjectExists = jest.fn();
const mockSetRedisObjectIfNotExistsWithExpiry = jest.fn();
const mockSetRedisObjectWithExpiry = jest.fn();
const mockDeleteRedisKey = jest.fn();
const mockBragiChat = jest.fn();
const mockPostTweetWithMedia = jest.fn();
const mockRetryFetch = jest.fn();

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

jest.mock('../../src/integrations/bragi', () => ({
  getBragiProxyClient: () => ({
    garmr: {
      execute: (fn: () => Promise<unknown>) => fn(),
    },
    instance: {
      chat: (...args: unknown[]) => mockBragiChat(...args),
    },
  }),
}));

jest.mock('../../src/integrations/twitter/clients', () => ({
  getTwitterClient: () => ({
    postTweetWithMedia: (...args: unknown[]) => mockPostTweetWithMedia(...args),
  }),
}));

jest.mock('../../src/integrations/retry', () => ({
  ...jest.requireActual<Record<string, unknown>>(
    '../../src/integrations/retry',
  ),
  retryFetch: (...args: unknown[]) => mockRetryFetch(...args),
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('agenticDigestTweet worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await con.getRepository(Source).save({
      id: AGENTS_DIGEST_SOURCE,
      type: SourceType.Machine,
      name: 'Agents Digest',
      image: 'http://image.com/agents-digest',
      handle: AGENTS_DIGEST_SOURCE,
    });
    mockCheckRedisObjectExists.mockResolvedValue(0);
    mockSetRedisObjectIfNotExistsWithExpiry.mockResolvedValue(true);
    mockSetRedisObjectWithExpiry.mockResolvedValue('OK');
    mockDeleteRedisKey.mockResolvedValue(1);
    mockBragiChat.mockResolvedValue({
      message: {
        content: 'Generated tweet body',
      },
    });
    mockPostTweetWithMedia.mockResolvedValue('tweet-id');
    mockRetryFetch.mockResolvedValue({
      headers: {
        get: jest.fn().mockReturnValue('image/png'),
      },
      arrayBuffer: jest
        .fn()
        .mockResolvedValue(Buffer.from('binary image').buffer),
    });
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should skip non-agentic sources', async () => {
    await expectSuccessfulTypedBackground<'api.v1.post-visible'>(worker, {
      post: {
        id: 'post-1',
        sourceId: 'a',
      },
    });

    expect(mockBragiChat).not.toHaveBeenCalled();
    expect(mockPostTweetWithMedia).not.toHaveBeenCalled();
  });

  it('should skip if done key already exists', async () => {
    mockCheckRedisObjectExists.mockResolvedValue(1);

    await expectSuccessfulTypedBackground<'api.v1.post-visible'>(worker, {
      post: {
        id: 'post-2',
        sourceId: AGENTS_DIGEST_SOURCE,
      },
    });

    expect(mockSetRedisObjectIfNotExistsWithExpiry).not.toHaveBeenCalled();
    expect(mockBragiChat).not.toHaveBeenCalled();
  });

  it('should generate tweet and post with image', async () => {
    await con.getRepository(FreeformPost).save({
      id: 'agentic-post',
      shortId: 'agentic-post',
      sourceId: AGENTS_DIGEST_SOURCE,
      type: PostType.Freeform,
      title: 'Agentic digest',
      content: 'The post content itself',
      contentHtml: '<p>The post content itself</p>',
    });

    await expectSuccessfulTypedBackground<'api.v1.post-visible'>(worker, {
      post: {
        id: 'agentic-post',
        sourceId: AGENTS_DIGEST_SOURCE,
      },
    });

    expect(mockBragiChat).toHaveBeenCalledTimes(1);
    expect(mockRetryFetch).toHaveBeenCalledTimes(1);
    expect(mockPostTweetWithMedia).toHaveBeenCalledTimes(1);
    expect(mockSetRedisObjectWithExpiry).toHaveBeenCalledTimes(1);
    expect(mockDeleteRedisKey).toHaveBeenCalledTimes(1);
  });

  it('should skip when lock is not acquired', async () => {
    mockSetRedisObjectIfNotExistsWithExpiry.mockResolvedValue(false);

    await expectSuccessfulTypedBackground<'api.v1.post-visible'>(worker, {
      post: {
        id: 'agentic-post-lock',
        sourceId: AGENTS_DIGEST_SOURCE,
      },
    });

    expect(mockBragiChat).not.toHaveBeenCalled();
    expect(mockPostTweetWithMedia).not.toHaveBeenCalled();
  });
});
