import { env } from 'node:process';
import { createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { Pipelines } from '@dailydotdev/schema';
import { GarmrService } from '../garmr';
import type { ServiceClient } from '../../types';

const garmrBragiService = new GarmrService({
  service: 'bragi',
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
  },
});

const transport = createGrpcTransport({
  baseUrl: env.BRAGI_ORIGIN!,
  httpVersion: '2',
});

export const getBragiClient = (
  clientTransport = transport,
): ServiceClient<typeof Pipelines> => {
  return {
    instance: createClient<typeof Pipelines>(Pipelines, clientTransport),
    garmr: garmrBragiService,
  };
};
