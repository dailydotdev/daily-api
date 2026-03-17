import type { FastifyLoggerInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { PubSub } from '@google-cloud/pubsub';
import {
  ONE_DAY_IN_SECONDS,
  ONE_WEEK_IN_SECONDS,
} from '../../src/common/constants';
import { channelDigestDefinitionsByKey } from '../../src/common/channelDigest/definitions';
import { generateChannelDigest } from '../../src/common/channelDigest/generate';
import {
  checkRedisObjectExists,
  deleteRedisKey,
  setRedisObjectIfNotExistsWithExpiry,
  setRedisObjectWithExpiry,
} from '../../src/redis';
import { typedWorkers } from '../../src/workers/index';
import worker from '../../src/workers/generateChannelDigest';

jest.mock('../../src/common/channelDigest/generate', () => ({
  generateChannelDigest: jest.fn(),
}));

jest.mock('../../src/redis', () => ({
  checkRedisObjectExists: jest.fn(),
  deleteRedisKey: jest.fn(),
  setRedisObjectIfNotExistsWithExpiry: jest.fn(),
  setRedisObjectWithExpiry: jest.fn(),
}));

const generateChannelDigestMock = generateChannelDigest as jest.MockedFunction<
  typeof generateChannelDigest
>;
const checkRedisObjectExistsMock =
  checkRedisObjectExists as jest.MockedFunction<typeof checkRedisObjectExists>;
const deleteRedisKeyMock = deleteRedisKey as jest.MockedFunction<
  typeof deleteRedisKey
>;
const setRedisObjectIfNotExistsWithExpiryMock =
  setRedisObjectIfNotExistsWithExpiry as jest.MockedFunction<
    typeof setRedisObjectIfNotExistsWithExpiry
  >;
const setRedisObjectWithExpiryMock =
  setRedisObjectWithExpiry as jest.MockedFunction<
    typeof setRedisObjectWithExpiry
  >;

const logger = {
  error: jest.fn(),
} as unknown as FastifyLoggerInstance;
const con = {} as DataSource;
const pubsub = {} as PubSub;

describe('generateChannelDigest worker', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    checkRedisObjectExistsMock.mockResolvedValue(0);
    deleteRedisKeyMock.mockResolvedValue(1);
    setRedisObjectIfNotExistsWithExpiryMock.mockResolvedValue(true);
    setRedisObjectWithExpiryMock.mockResolvedValue('OK');
    generateChannelDigestMock.mockResolvedValue(null);
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should log and skip unknown digests', async () => {
    await worker.handler(
      {
        messageId: '1',
        data: {
          digestKey: 'missing',
          scheduledAt: '2026-03-03T10:00:00.000Z',
        },
      },
      con,
      logger,
      pubsub,
    );

    expect(generateChannelDigestMock).not.toHaveBeenCalled();
    expect((logger.error as jest.Mock).mock.calls[0][1]).toBe(
      'Channel digest definition not found',
    );
  });

  it('should log and skip invalid scheduledAt values', async () => {
    await worker.handler(
      {
        messageId: '1',
        data: {
          digestKey: 'agentic',
          scheduledAt: 'not-a-date',
        },
      },
      con,
      logger,
      pubsub,
    );

    expect(generateChannelDigestMock).not.toHaveBeenCalled();
    expect((logger.error as jest.Mock).mock.calls[0][1]).toBe(
      'Channel digest scheduledAt is invalid',
    );
  });

  it('should skip if the digest run is already marked done', async () => {
    checkRedisObjectExistsMock.mockResolvedValue(1);

    await worker.handler(
      {
        messageId: '1',
        data: {
          digestKey: 'agentic',
          scheduledAt: '2026-03-03T10:00:00.000Z',
        },
      },
      con,
      logger,
      pubsub,
    );

    expect(setRedisObjectIfNotExistsWithExpiryMock).not.toHaveBeenCalled();
    expect(generateChannelDigestMock).not.toHaveBeenCalled();
  });

  it('should skip if the digest lock cannot be acquired', async () => {
    setRedisObjectIfNotExistsWithExpiryMock.mockResolvedValue(false);

    await worker.handler(
      {
        messageId: '1',
        data: {
          digestKey: 'agentic',
          scheduledAt: '2026-03-03T10:00:00.000Z',
        },
      },
      con,
      logger,
      pubsub,
    );

    expect(generateChannelDigestMock).not.toHaveBeenCalled();
  });

  it('should run the digest with the scheduled timestamp and mark it done', async () => {
    await worker.handler(
      {
        messageId: 'message-1',
        data: {
          digestKey: 'agentic',
          scheduledAt: '2026-03-03T10:00:00.000Z',
        },
      },
      con,
      logger,
      pubsub,
    );

    expect(generateChannelDigestMock).toHaveBeenCalledWith({
      con,
      definition: channelDigestDefinitionsByKey.get('agentic'),
      now: new Date('2026-03-03T10:00:00.000Z'),
    });
    expect(setRedisObjectWithExpiryMock).toHaveBeenCalledWith(
      'channel-digest:done:agentic:2026-03-03T10:00:00.000Z',
      '1',
      2 * ONE_DAY_IN_SECONDS,
    );
    expect(deleteRedisKeyMock).toHaveBeenCalledWith(
      'channel-digest:lock:agentic:2026-03-03T10:00:00.000Z',
    );
  });

  it('should use the weekly done ttl for weekly digests', async () => {
    channelDigestDefinitionsByKey.set('weekly-test', {
      key: 'weekly-test',
      sourceId: 'weekly-test-source',
      channels: ['weekly-test'],
      targetAudience: 'weekly digest audience',
      frequency: 'weekly',
      includeSentiment: false,
    });

    try {
      await worker.handler(
        {
          messageId: 'message-1',
          data: {
            digestKey: 'weekly-test',
            scheduledAt: '2026-03-02T10:00:00.000Z',
          },
        },
        con,
        logger,
        pubsub,
      );

      expect(setRedisObjectWithExpiryMock).toHaveBeenCalledWith(
        'channel-digest:done:weekly-test:2026-03-02T10:00:00.000Z',
        '1',
        2 * ONE_WEEK_IN_SECONDS,
      );
    } finally {
      channelDigestDefinitionsByKey.delete('weekly-test');
    }
  });
});
