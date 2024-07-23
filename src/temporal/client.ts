import { Client } from '@temporalio/client';
import { Connection as TemporalConnection } from '@temporalio/client/lib/connection';
import { TEMPORAL_ADDRESS, TEMPORAL_NAMESPACE } from './config';
import { readFileSync } from 'fs';

let client: Client;

const getOptions = () => {
  const address = TEMPORAL_ADDRESS;
  const namespace = TEMPORAL_NAMESPACE;

  if (!process.env.TEMPORAL_CLIENT_CERT_PATH) {
    return { namespace, address };
  }

  const crt = readFileSync(process.env.TEMPORAL_CLIENT_CERT_PATH);
  const key = readFileSync(process.env.TEMPORAL_CLIENT_KEY_PATH);

  return {
    address,
    namespace,
    tls: {
      clientCertPair: {
        crt,
        key,
      },
    },
  };
};

export const getTemporalClient = async (): Promise<Client> => {
  if (client) {
    return client;
  }

  const connection = await TemporalConnection.connect(getOptions());

  client = new Client({ connection, namespace: TEMPORAL_NAMESPACE });

  return client;
};
