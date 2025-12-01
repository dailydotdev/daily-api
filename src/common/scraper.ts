import { GarmrService } from '../integrations/garmr';

export const garmScraperService = new GarmrService({
  service: 'daily-scraper',
  breakerOpts: {
    halfOpenAfter: 10 * 1000,
    threshold: 0.2,
    duration: 20 * 1000,
    minimumRps: 1,
  },
  retryOpts: {
    maxAttempts: 3,
  },
});
