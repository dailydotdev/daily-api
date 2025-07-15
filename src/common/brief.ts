import { FeedClient } from '../integrations/feed/clients';
import { GarmrService } from '../integrations/garmr';

export const briefFeedClient = new FeedClient(process.env.BRIEFING_FEED, {
  garmr: new GarmrService({
    service: 'feed-client-generate-brief',
    breakerOpts: {
      halfOpenAfter: 5 * 1000,
      threshold: 0.1,
      duration: 10 * 1000,
      minimumRps: 1,
    },
    limits: {
      maxRequests: 150,
      queuedRequests: 100,
    },
    retryOpts: {
      maxAttempts: 0,
    },
  }),
});
