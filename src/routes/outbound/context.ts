import { createContextKey } from '@connectrpc/connect';

export const outboundRpcContext = createContextKey<{ authorized: boolean }>(
  { authorized: false },
  {
    description: 'Outbound service context',
  },
);
