import { env } from 'node:process';
import { createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { BrokkrService } from '@dailydotdev/schema';
import { GarmrService, GarmrNoopService } from '../integrations/garmr';
import type { ServiceClient } from '../types';
import {
  isMockEnabled,
  mockBrokkrParseOpportunityResponse,
} from '../mocks/opportunity/services';

const garmBrokkrService = new GarmrService({
  service: 'brokkr',
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
  },
  retryOpts: {
    maxAttempts: 1,
  },
});

const transport = createGrpcTransport({
  baseUrl: env.BROKKR_ORIGIN,
  httpVersion: '2',
});

export const getBrokkrClient = (
  clientTransport = transport,
): ServiceClient<typeof BrokkrService> => {
  if (isMockEnabled()) {
    return {
      instance: {
        parseOpportunity: async () => mockBrokkrParseOpportunityResponse(),
        extractMarkdown: async () => ({ markdown: 'Mock CV content' }),
      } as unknown as ReturnType<typeof createClient<typeof BrokkrService>>,
      garmr: new GarmrNoopService(),
    };
  }

  return {
    instance: createClient<typeof BrokkrService>(
      BrokkrService,
      clientTransport,
    ),
    garmr: garmBrokkrService,
  };
};

export const extractMarkdownFromCV = async (
  blobName: string,
  bucketName: string,
) =>
  garmBrokkrService.execute(async () =>
    getBrokkrClient().instance.extractMarkdown({ blobName, bucketName }),
  );
