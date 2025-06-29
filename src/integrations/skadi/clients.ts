import { RequestInit } from 'node-fetch';
import {
  ISkadiClient,
  SkadiResponse,
  type GetCampaignByIdProps,
  type GetCampaignsProps,
  type PostBoostReach,
  type PromotedPost,
  type PromotedPostList,
} from './types';
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

  startPostCampaign({
    postId,
    userId,
    duration,
    budget,
  }: {
    postId: string;
    userId: string;
    duration: number;
    budget: number;
  }): Promise<{ campaignId: string }> {
    return this.garmr.execute(() => {
      return fetchParse(`${this.url}/promote/post/create`, {
        ...this.fetchOptions,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postId, userId, duration, budget }),
      });
    });
  }

  cancelPostCampaign({
    postId,
    userId,
  }: {
    postId: string;
    userId: string;
  }): Promise<{ success: boolean }> {
    return this.garmr.execute(() => {
      return fetchParse(`${this.url}/promote/post/cancel`, {
        ...this.fetchOptions,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postId, userId }),
      });
    });
  }

  estimatePostBoostReach({
    postId,
    userId,
    duration,
    budget,
  }: {
    postId: string;
    userId: string;
    duration: number;
    budget: number;
  }): Promise<PostBoostReach> {
    return this.garmr.execute(() => {
      return fetchParse(`${this.url}/promote/post/reach`, {
        ...this.fetchOptions,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postId, userId, duration, budget }),
      });
    });
  }

  getCampaignById({
    campaignId,
    userId,
  }: GetCampaignByIdProps): Promise<PromotedPost> {
    return this.garmr.execute(() => {
      return fetchParse(`${this.url}/promote/post/get`, {
        ...this.fetchOptions,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ campaignId, userId }),
      });
    });
  }

  getCampaigns({
    limit,
    offset,
    userId,
  }: GetCampaignsProps): Promise<PromotedPostList> {
    return this.garmr.execute(() => {
      return fetchParse(`${this.url}/promote/post/list`, {
        ...this.fetchOptions,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit, offset, userId }),
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

const garmBoostService = new GarmrService({
  service: SkadiClient.name,
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
  },
  retryOpts: {
    maxAttempts: 1,
  },
});

export const skadiBoostClient = new SkadiClient(process.env.SKADI_ORIGIN, {
  garmr: garmBoostService,
});
