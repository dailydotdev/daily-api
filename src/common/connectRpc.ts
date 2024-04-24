import { ConnectRouter, createContextValues } from '@connectrpc/connect';
import { fastifyConnectPlugin } from '@connectrpc/connect-fastify';
import { RegisterOptions } from 'fastify';
import fp from 'fastify-plugin';

import { createContextKey } from '@connectrpc/connect';

export const baseRpcContext = createContextKey<{
  service: boolean;
}>(
  { service: false },
  {
    description: 'Base context',
  },
);

export const connectRpcPlugin = fp<
  {
    routes: (router: ConnectRouter) => void;
  } & RegisterOptions
>(
  (fastify, opts, done) => {
    fastify.register(fastifyConnectPlugin, {
      routes: opts.routes,
      prefix: opts.prefix,
      jsonOptions: {
        ignoreUnknownFields: false,
      },
      binaryOptions: {
        readUnknownFields: false,
        writeUnknownFields: false,
      },
      contextValues: (req) => {
        return createContextValues().set(baseRpcContext, {
          service: req.service,
        });
      },
    });

    done();
  },
  {
    name: 'connectRpc',
  },
);
