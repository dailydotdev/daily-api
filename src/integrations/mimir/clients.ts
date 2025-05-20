import { RequestInit } from 'node-fetch';
import { GarmrNoopService, IGarmrService, GarmrService } from '../garmr';
import { fetchOptions as globalFetchOptions } from '../../http';
import { fetchParse } from '../retry';
import { IMimirClient, MimirResponse } from './types';

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

  search({
    query,
    version,
    offset = 0,
    limit = 10,
  }: {
    query: string;
    version: number;
    offset: number;
    limit: number;
  }): Promise<MimirResponse> {
    console.log('searching mimir', query);
    return this.garmr.execute(() => {
      return fetchParse(`${this.url}/v1/search`, {
        ...this.fetchOptions,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          version,
          offset,
          limit,
        }),
      });
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
