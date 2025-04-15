import { RequestInit } from 'node-fetch';
import { ISkadiClient, SkadiResponse } from './types';
import { GarmrNoopService, IGarmrService, GarmrService } from '../garmr';
import { fetchOptions as globalFetchOptions } from '../../http';
import { fetchParse } from '../retry';

export class SkadiClient implements ISkadiClient {
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

  getAd(
    placement: string,
    metadata: {
      USERID: string;
    },
  ): Promise<SkadiResponse> {
    return this.garmr.execute(() => {
      return fetchParse(`${this.url}/private`, {
        ...this.fetchOptions,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          placement,
          metadata,
        }),
      });
    });
  }
}

const garmrSkadiService = new GarmrService({
  service: SkadiClient.name,
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
  },
});

export const skadiClient = new SkadiClient(process.env.SKADI_ORIGIN, {
  garmr: garmrSkadiService,
});
