import type { RequestInit } from 'undici';
import { GarmrNoopService, IGarmrService, GarmrService } from '../garmr';
import { fetchOptions as globalFetchOptions } from '../../http';
import { fetchParseBinary } from '../retry';
import { IMimirClient } from './types';
import { SearchRequest, SearchResponse } from '@dailydotdev/schema';

export class MimirClient implements IMimirClient {
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

  search(searchRequest: SearchRequest): Promise<SearchResponse> {
    return this.garmr.execute(() => {
      return fetchParseBinary(
        `${this.url}/v1/search`,
        {
          ...this.fetchOptions,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-protobuf',
          },
          body: searchRequest.toBinary(),
        },
        new SearchResponse(),
      );
    });
  }
}

const garmrMimirService = new GarmrService({
  service: MimirClient.name,
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
  },
});

export const mimirClient = new MimirClient(process.env.MIMIR_ORIGIN!, {
  garmr: garmrMimirService,
});
