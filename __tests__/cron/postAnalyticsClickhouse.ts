import { crons } from '../../src/cron/index';
import { postAnalyticsClickhouseCron as cron } from '../../src/cron/postAnalyticsClickhouse';

describe('postAnalyticsClickhouse cron', () => {
  it('should be registered', () => {
    const registeredWorker = crons.find((item) => item.name === cron.name);

    expect(registeredWorker).toBeDefined();
  });
});
