import { env } from 'node:process';
import { createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { BrokkrService } from '@dailydotdev/schema';
import { GarmrService } from '../integrations/garmr';

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

export const getBrokkrClient = (clientTransport = transport) =>
  createClient<typeof BrokkrService>(BrokkrService, clientTransport);

export const extractMarkdownFromCV = async (
  blobName: string,
  bucketName: string,
) =>
  garmBrokkrService.execute(async () =>
    getBrokkrClient().extractMarkdown({ blobName, bucketName }),
  );
