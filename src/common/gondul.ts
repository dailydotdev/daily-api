import { createGrpcTransport } from '@connectrpc/connect-node';
import { GarmrService } from '../integrations/garmr';
import { createClient } from '@connectrpc/connect';
import { ApplicationService as GondulService } from '@dailydotdev/schema';
import type { ServiceClient } from '../types';

const transport = createGrpcTransport({
  baseUrl: 'http://host.docker.internal:9021',
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
