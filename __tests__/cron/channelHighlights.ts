import type { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { ChannelHighlightDefinition } from '../../src/entity/ChannelHighlightDefinition';
import * as typedPubsub from '../../src/common/typedPubsub';
import channelHighlights from '../../src/cron/channelHighlights';
import { crons } from '../../src/cron/index';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('channelHighlights cron', () => {
  afterEach(async () => {
    jest.restoreAllMocks();
    await con.getRepository(ChannelHighlightDefinition).clear();
  });

  it('should be registered', () => {
    const registeredCron = crons.find(
      (item) => item.name === channelHighlights.name,
    );

    expect(registeredCron).toBeDefined();
  });

  it('should enqueue enabled highlight definitions', async () => {
    const triggerTypedEventSpy = jest
      .spyOn(typedPubsub, 'triggerTypedEvent')
      .mockResolvedValue();

    await con.getRepository(ChannelHighlightDefinition).save([
      {
        channel: 'backend',
        enabled: true,
        mode: 'shadow',
        candidateHorizonHours: 72,
        maxItems: 10,
      },
      {
        channel: 'vibes',
        enabled: true,
        mode: 'shadow',
        candidateHorizonHours: 72,
        maxItems: 10,
      },
      {
        channel: 'disabled',
        enabled: false,
        mode: 'shadow',
        candidateHorizonHours: 72,
        maxItems: 10,
      },
    ]);

    const startedAt = Date.now();
    await channelHighlights.handler(con, {} as never, {} as never);
    const completedAt = Date.now();

    expect(triggerTypedEventSpy.mock.calls).toEqual([
      [
        {},
        'api.v1.generate-channel-highlight',
        {
          channel: 'backend',
          scheduledAt: expect.any(String),
        },
      ],
      [
        {},
        'api.v1.generate-channel-highlight',
        {
          channel: 'vibes',
          scheduledAt: expect.any(String),
        },
      ],
    ]);

    const scheduledAt = Date.parse(
      triggerTypedEventSpy.mock.calls[0][2].scheduledAt,
    );
    expect(scheduledAt).toBeGreaterThanOrEqual(startedAt);
    expect(scheduledAt).toBeLessThanOrEqual(completedAt);
    expect(triggerTypedEventSpy.mock.calls[0][2].scheduledAt).toBe(
      triggerTypedEventSpy.mock.calls[1][2].scheduledAt,
    );
  });
});
