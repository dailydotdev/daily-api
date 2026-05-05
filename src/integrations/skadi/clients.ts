import { RequestInit } from 'node-fetch';
import {
  ISkadiClient,
  SkadiResponse,
  type EngagementCreative,
  type SkadiAd,
} from './types';
import { GarmrNoopService, IGarmrService, GarmrService } from '../garmr';
import { fetchOptions as globalFetchOptions } from '../../http';
import { fetchParse } from '../retry';
import { counters } from '../../telemetry';

export class SkadiClient<TValue> implements ISkadiClient<TValue> {
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
  ): Promise<SkadiResponse<TValue>> {
    return this.garmr.execute(({ signal }) => {
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
        signal,
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

export const skadiPersonalizedDigestClient = new SkadiClient<{
  digest: SkadiAd;
}>(process.env.SKADI_ORIGIN, {
  garmr: garmrSkadiPersonalizedDigestService,
});

const garmrSkadiEngagementService = new GarmrService({
  service: `${SkadiClient.name}Engagement`,
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
  },
  retryOpts: {
    maxAttempts: 0,
  },
  timeoutMs: 600,
});

export const skadiEngagementClient = new SkadiClient<{
  engagement: EngagementCreative;
}>(process.env.SKADI_ORIGIN, {
  garmr: garmrSkadiEngagementService,
});
