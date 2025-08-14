import { crons } from '../../src/cron/index';
import { postAnalyticsHistoryDayClickhouseCron as cron } from '../../src/cron/postAnalyticsHistoryDayClickhouse';

describe('postAnalyticsHistoryDayClickhouse cron', () => {
  it('should be registered', () => {
    const registeredWorker = crons.find((item) => item.name === cron.name);

    expect(registeredWorker).toBeDefined();
  });
});
