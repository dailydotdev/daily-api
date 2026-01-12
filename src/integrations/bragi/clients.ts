import { RequestInit } from 'node-fetch';
import { GarmrNoopService, IGarmrService, GarmrService } from '../garmr';
import { fetchOptions as globalFetchOptions } from '../../http';
import { fetchParseBinary } from '../retry';
import { IBragiClient } from './types';
import {
  ParseFeedbackRequest,
  ParseFeedbackResponse,
} from '@dailydotdev/schema';

export class BragiClient implements IBragiClient {
  private readonly fetchOptions: RequestInit;
  private readonly garmr: IGarmrService;

  constructor(
    private readonly url: string,
    options?: {
      fetchOptions?: RequestInit;
      garmr?: IGarmrService;
    },
  ) {
    const {
      fetchOptions = globalFetchOptions,
      garmr = new GarmrNoopService(),
    } = options || {};

    this.fetchOptions = fetchOptions;
    this.garmr = garmr;
  }

  parseFeedback(request: ParseFeedbackRequest): Promise<ParseFeedbackResponse> {
    return this.garmr.execute(() => {
      return fetchParseBinary(
        `${this.url}/v1/parse-feedback`,
        {
          ...this.fetchOptions,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-protobuf',
          },
          body: request.toBinary(),
        },
        new ParseFeedbackResponse(),
      );
    });
  }
}

const garmrBragiService = new GarmrService({
  service: BragiClient.name,
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
  },
});

export const bragiClient = new BragiClient(process.env.BRAGI_ORIGIN!, {
  garmr: garmrBragiService,
});
