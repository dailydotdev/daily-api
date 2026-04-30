import type { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
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
  });

  it('should be registered', () => {
    const registeredCron = crons.find(
      (item) => item.name === channelHighlights.name,
    );

    expect(registeredCron).toBeDefined();
  });

  it('should enqueue a global highlight generation run', async () => {
    const triggerTypedEventSpy = jest
      .spyOn(typedPubsub, 'triggerTypedEvent')
      .mockResolvedValue();

    const startedAt = Date.now();
    await channelHighlights.handler(con, {} as never, {} as never);
    const completedAt = Date.now();

    expect(triggerTypedEventSpy.mock.calls).toEqual([
      [
        {},
        'api.v1.generate-highlights',
        {
          scheduledAt: expect.any(String),
        },
      ],
    ]);

    const scheduledAt = Date.parse(
      triggerTypedEventSpy.mock.calls[0][2].scheduledAt,
    );
    expect(scheduledAt).toBeGreaterThanOrEqual(startedAt);
    expect(scheduledAt).toBeLessThanOrEqual(completedAt);
  });
});
