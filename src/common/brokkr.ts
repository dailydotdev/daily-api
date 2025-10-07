import { env } from 'node:process';
import { createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { BrokkrService } from '@dailydotdev/schema';

const transport = createGrpcTransport({
  baseUrl: env.BROKKR_ORIGIN,
  httpVersion: '2',
});

export const getBrokkrClient = (clientTransport = transport) =>
  createClient<typeof BrokkrService>(BrokkrService, clientTransport);

export const extractMarkdownFromCV = async (
  blobName: string,
  bucketName: string,
) => getBrokkrClient().extractMarkdown({ blobName, bucketName });
