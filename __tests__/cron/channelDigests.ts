import type { FastifyLoggerInstance } from 'fastify';
import { PubSub } from '@google-cloud/pubsub';
import cron from '../../src/cron/channelDigests';
import {
  channelDigestDefinitions,
  channelDigestDefinitionsByKey,
} from '../../src/common/channelDigest/definitions';
import { triggerTypedEvent } from '../../src/common/typedPubsub';
import { crons } from '../../src/cron/index';

jest.mock('../../src/common/typedPubsub', () => ({
  triggerTypedEvent: jest.fn(),
}));

const triggerTypedEventMock = triggerTypedEvent as jest.MockedFunction<
  typeof triggerTypedEvent
>;

const logger = {} as FastifyLoggerInstance;
const pubsub = {} as PubSub;

describe('channelDigests cron', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-03T10:00:00.000Z'));
    triggerTypedEventMock.mockResolvedValue();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be registered', () => {
    const registeredCron = crons.find((item) => item.name === cron.name);

    expect(registeredCron).toBeDefined();
  });

  it('should enqueue all configured digests', async () => {
    await cron.handler({} as never, logger, pubsub);

    expect(triggerTypedEventMock.mock.calls).toEqual(
      channelDigestDefinitions.map(({ key }) => [
        logger,
        'api.v1.generate-channel-digest',
        {
          digestKey: key,
          scheduledAt: '2026-03-03T10:00:00.000Z',
        },
      ]),
    );
  });

  it('should skip weekly digests when it is not monday', async () => {
    const weeklyDefinition = {
      key: 'weekly-test',
      sourceId: 'weekly-test-source',
      channels: ['weekly-test'],
      targetAudience: 'weekly digest audience',
      frequency: 'weekly',
      includeSentiment: false,
    };

    channelDigestDefinitions.push(weeklyDefinition);
    channelDigestDefinitionsByKey.set(weeklyDefinition.key, weeklyDefinition);

    try {
      jest.setSystemTime(new Date('2026-03-04T10:00:00.000Z'));

      await cron.handler({} as never, logger, pubsub);

      expect(triggerTypedEventMock.mock.calls).toEqual(
        channelDigestDefinitions
          .filter(({ key }) => key !== weeklyDefinition.key)
          .map(({ key }) => [
            logger,
            'api.v1.generate-channel-digest',
            {
              digestKey: key,
              scheduledAt: '2026-03-04T10:00:00.000Z',
            },
          ]),
      );
    } finally {
      channelDigestDefinitions.pop();
      channelDigestDefinitionsByKey.delete(weeklyDefinition.key);
    }
  });
});
