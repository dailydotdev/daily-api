import { crons } from '../../src/cron/index';
import cron from '../../src/cron/updateHighlightedViews';

describe('updateHighlightedViews cron', () => {
  it('should be registered', () => {
    const registeredWorker = crons.find((item) => item.name === cron.name);

    expect(registeredWorker).toBeDefined();
  });
});
