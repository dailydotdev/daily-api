import type { RequestInit } from 'undici';
import { ISkadiClient, SkadiResponse } from './types';
import { GarmrNoopService, IGarmrService, GarmrService } from '../garmr';
import { fetchOptions as globalFetchOptions } from '../../http';
import { fetchParse } from '../retry';
import { counters } from '../../telemetry';

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

const garmrSkadiPersonalizedDigestService = new GarmrService({
  service: SkadiClient.name,
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
    minimumRps: 1,
  },
  limits: {
    maxRequests: 150,
    queuedRequests: 100,
  },
  retryOpts: {
    maxAttempts: 0,
  },
  events: {
    onBreak: ({ meta }) => {
      counters?.['personalized-digest']?.garmrBreak?.add(1, {
        service: meta.service,
      });
    },
    onHalfOpen: ({ meta }) => {
      counters?.['personalized-digest']?.garmrHalfOpen?.add(1, {
        service: meta.service,
      });
    },
    onReset: ({ meta }) => {
      counters?.['personalized-digest']?.garmrReset?.add(1, {
        service: meta.service,
      });
    },
    onRetry: ({ meta }) => {
      counters?.['personalized-digest']?.garmrRetry?.add(1, {
        service: meta.service,
      });
    },
  },
});

export const skadiPersonalizedDigestClient = new SkadiClient(
  process.env.SKADI_ORIGIN,
  {
    garmr: garmrSkadiPersonalizedDigestService,
  },
);
