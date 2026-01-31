import { createGrpcTransport } from '@connectrpc/connect-node';
import { GarmrService, GarmrNoopService } from '../integrations/garmr';
import { createClient } from '@connectrpc/connect';
import {
  ApplicationService as GondulService,
  OpportunityService as GondulOpportunityService,
} from '@dailydotdev/schema';
import type { ServiceClient } from '../types';
import {
  isMockEnabled,
  mockGondulScreeningQuestionsResponse,
  mockPreviewUserIds,
  mockPreviewTotalCount,
} from '../mocks/opportunity/services';

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
  if (isMockEnabled()) {
    return {
      instance: {
        screeningQuestions: async () => mockGondulScreeningQuestionsResponse(),
      } as unknown as ReturnType<typeof createClient<typeof GondulService>>,
      garmr: new GarmrNoopService(),
    };
  }

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
  if (isMockEnabled()) {
    return {
      instance: {
        // Preview is async - it triggers a background job
        // For mock, we simulate immediate completion by returning userIds
        preview: async () => ({
          userIds: mockPreviewUserIds,
          totalCount: mockPreviewTotalCount,
        }),
      } as unknown as ReturnType<
        typeof createClient<typeof GondulOpportunityService>
      >,
      garmr: new GarmrNoopService(),
    };
  }

  return {
    instance: createClient<typeof GondulOpportunityService>(
      GondulOpportunityService,
      clientTransport,
    ),
    garmr: garmGondulService,
  };
};
