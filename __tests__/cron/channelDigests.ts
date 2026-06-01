import type { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { ChannelDigest } from '../../src/entity/ChannelDigest';
import { AGENTS_DIGEST_SOURCE } from '../../src/entity/Source';
import * as typedPubsub from '../../src/common/typedPubsub';
import * as channelDigestsModule from '../../src/cron/channelDigests';
import { crons } from '../../src/cron/index';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('channelDigests cron', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be registered', () => {
    const registeredCron = crons.find(
      (item) => item.name === channelDigestsModule.default.name,
    );

    expect(registeredCron).toBeDefined();
  });

  it('should enqueue all configured digests for the current day', async () => {
    jest
      .spyOn(channelDigestsModule, 'getChannelDigestsNow')
      .mockReturnValue(new Date('2026-03-02T10:00:00.000Z'));
    const triggerTypedEventSpy = jest
      .spyOn(typedPubsub, 'triggerTypedEvent')
      .mockResolvedValue();

    await con.getRepository(ChannelDigest).save([
      {
        key: 'agentic',
        sourceId: AGENTS_DIGEST_SOURCE,
        channel: 'vibes',
        targetAudience: 'audience',
        frequency: 'daily',
        enabled: true,
      },
      {
        key: 'weekly-test',
        sourceId: 'weekly-source',
        channel: 'weekly',
        targetAudience: 'weekly audience',
        frequency: 'weekly',
        enabled: true,
      },
    ]);

    await channelDigestsModule.default.handler(con, {} as never, {} as never);

    expect(triggerTypedEventSpy.mock.calls).toEqual([
      [
        {},
        'api.v1.generate-channel-digest',
        {
          digestKey: 'agentic',
          scheduledAt: '2026-03-02T10:00:00.000Z',
        },
      ],
      [
        {},
        'api.v1.generate-channel-digest',
        {
          digestKey: 'weekly-test',
          scheduledAt: '2026-03-02T10:00:00.000Z',
        },
      ],
    ]);
  });

  it('should skip weekly digests when it is not monday', async () => {
    jest
      .spyOn(channelDigestsModule, 'getChannelDigestsNow')
      .mockReturnValue(new Date('2026-03-04T10:00:00.000Z'));
    const triggerTypedEventSpy = jest
      .spyOn(typedPubsub, 'triggerTypedEvent')
      .mockResolvedValue();

    await con.getRepository(ChannelDigest).save([
      {
        key: 'agentic',
        sourceId: AGENTS_DIGEST_SOURCE,
        channel: 'vibes',
        targetAudience: 'audience',
        frequency: 'daily',
        enabled: true,
      },
      {
        key: 'weekly-test',
        sourceId: 'weekly-source',
        channel: 'weekly',
        targetAudience: 'weekly audience',
        frequency: 'weekly',
        enabled: true,
      },
    ]);
    await channelDigestsModule.default.handler(con, {} as never, {} as never);

    expect(triggerTypedEventSpy.mock.calls).toEqual([
      [
        {},
        'api.v1.generate-channel-digest',
        {
          digestKey: 'agentic',
          scheduledAt: '2026-03-04T10:00:00.000Z',
        },
      ],
    ]);
  });
});
