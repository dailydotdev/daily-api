import { createGrpcTransport } from '@connectrpc/connect-node';
import { GarmrService } from '../integrations/garmr';
import { createClient } from '@connectrpc/connect';
import {
  ApplicationService as GondulService,
  OpportunityService as GondulOpportunityService,
} from '@dailydotdev/schema';
import type { ServiceClient } from '../types';

const transport = createGrpcTransport({
  baseUrl: process.env.GONDUL_ORIGIN,
  httpVersion: '2',
});

const garmGondulService = new GarmrService({
  service: 'gondul',
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
  },
  retryOpts: {
    maxAttempts: 3,
  },
});

export const getGondulClient = (
  clientTransport = transport,
): ServiceClient<typeof GondulService> => {
  return {
    instance: createClient<typeof GondulService>(
      GondulService,
      clientTransport,
    ),
    garmr: garmGondulService,
  };
};

const gondulOpportunityServerTransport = createGrpcTransport({
  baseUrl: process.env.GONDUL_OPPORTUNITY_SERVER_ORIGIN,
  httpVersion: '2',
});

export const getGondulOpportunityServiceClient = (
  clientTransport = gondulOpportunityServerTransport,
): ServiceClient<typeof GondulOpportunityService> => {
  return {
    instance: createClient<typeof GondulOpportunityService>(
      GondulOpportunityService,
      clientTransport,
    ),
    garmr: garmGondulService,
  };
};
