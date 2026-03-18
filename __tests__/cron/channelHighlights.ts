import type { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { ChannelHighlightDefinition } from '../../src/entity/ChannelHighlightDefinition';
import * as typedPubsub from '../../src/common/typedPubsub';
import * as channelHighlightsModule from '../../src/cron/channelHighlights';
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
      (item) => item.name === channelHighlightsModule.default.name,
    );

    expect(registeredCron).toBeDefined();
  });

  it('should enqueue enabled highlight definitions', async () => {
    jest
      .spyOn(channelHighlightsModule, 'getChannelHighlightsNow')
      .mockReturnValue(new Date('2026-03-02T10:00:00.000Z'));
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

    await channelHighlightsModule.default.handler(
      con,
      {} as never,
      {} as never,
    );

    expect(triggerTypedEventSpy.mock.calls).toEqual([
      [
        {},
        'api.v1.generate-channel-highlight',
        {
          channel: 'backend',
          scheduledAt: '2026-03-02T10:00:00.000Z',
        },
      ],
      [
        {},
        'api.v1.generate-channel-highlight',
        {
          channel: 'vibes',
          scheduledAt: '2026-03-02T10:00:00.000Z',
        },
      ],
    ]);
  });
});
