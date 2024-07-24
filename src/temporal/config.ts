import { readFileSync } from 'fs';

interface ServerOptions {
  address: string;
  namespace: string;
  tls?: {
    clientCertPair: {
      crt: Buffer;
      key: Buffer;
    };
  };
}

export const TEMPORAL_ADDRESS =
  process.env.TEMPORAL_ADDRESS || 'host.docker.internal:7233';
export const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE || 'default';

let serverOptions: ServerOptions;

export const getTemporalServerOptions = () => {
  if (serverOptions) {
    return serverOptions;
  }

  const address = TEMPORAL_ADDRESS;
  const namespace = TEMPORAL_NAMESPACE;

  if (!process.env.TEMPORAL_CLIENT_CERT_PATH) {
    serverOptions = { namespace, address };
    return serverOptions;
  }

  const crt = readFileSync(process.env.TEMPORAL_CLIENT_CERT_PATH);
  const key = readFileSync(process.env.TEMPORAL_CLIENT_KEY_PATH);

  serverOptions = {
    address,
    namespace,
    tls: {
      clientCertPair: {
        crt,
        key,
      },
    },
  };

  return serverOptions;
};
