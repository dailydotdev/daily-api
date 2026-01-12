import { env } from 'node:process';
import { createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import {
  Pipelines,
  ParseFeedbackRequest,
  ParseFeedbackResponse,
} from '@dailydotdev/schema';
import { GarmrService, IGarmrService } from '../garmr';
import type { ServiceClient } from '../../types';
import { IBragiClient } from './types';

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

export class BragiClient implements IBragiClient {
  private readonly client: ServiceClient<typeof Pipelines>;

  constructor(
    private readonly garmr: IGarmrService = garmrBragiService,
    clientTransport = transport,
  ) {
    this.client = {
      instance: createClient<typeof Pipelines>(Pipelines, clientTransport),
      garmr: this.garmr,
    };
  }

  parseFeedback(request: ParseFeedbackRequest): Promise<ParseFeedbackResponse> {
    return this.garmr.execute(() =>
      this.client.instance.parseFeedback(request),
    );
  }
}

export const bragiClient = new BragiClient(garmrBragiService);
