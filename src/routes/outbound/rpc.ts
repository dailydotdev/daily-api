import { Code, ConnectError } from '@connectrpc/connect';
import type { ConnectRouter, HandlerContext } from '@connectrpc/connect';
import { Pipelines } from '@dailydotdev/schema';
import { getBragiClient } from '../../integrations/bragi/clients';
import { outboundRpcContext } from './context';

const verifyAuth = (context: HandlerContext) => {
  if (!context.values.get(outboundRpcContext).authorized) {
    throw new ConnectError('unauthenticated', Code.Unauthenticated);
  }
};

export default (router: ConnectRouter) => {
  router.rpc(
    Pipelines,
    Pipelines.methods.findJobVacancies,
    async (req, ctx) => {
      verifyAuth(ctx);
      const client = getBragiClient();
      return client.garmr.execute(() => client.instance.findJobVacancies(req));
    },
  );

  router.rpc(Pipelines, Pipelines.methods.findCompanyNews, async (req, ctx) => {
    verifyAuth(ctx);
    const client = getBragiClient();
    return client.garmr.execute(() => client.instance.findCompanyNews(req));
  });

  router.rpc(
    Pipelines,
    Pipelines.methods.findContactActivity,
    async (req, ctx) => {
      verifyAuth(ctx);
      const client = getBragiClient();
      return client.garmr.execute(() =>
        client.instance.findContactActivity(req),
      );
    },
  );

  router.rpc(
    Pipelines,
    Pipelines.methods.generateRecruiterEmail,
    async (req, ctx) => {
      verifyAuth(ctx);
      const client = getBragiClient();
      return client.garmr.execute(() =>
        client.instance.generateRecruiterEmail(req),
      );
    },
  );
};
