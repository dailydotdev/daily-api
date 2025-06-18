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

  startPostCampaign() // params: {
  //   postId: string;
  //   userId: string;
  //   duration: number;
  //   budget: number;
  // }
  : Promise<{ campaignId: string }> {
    // TODO: once Ad Server is ready, we should update this.
    return this.garmr.execute(() => {
      // return fetchParse(`${this.url}/private/campaign`, {
      //   ...this.fetchOptions,
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(params),
      // });
      return Promise.resolve({
        campaignId: 'mock-campaign-id', // Mock response for testing
      });
    });
  }

  cancelPostCampaign(params: {
    postId: string;
    userId: string;
  }): Promise<{ success: boolean }> {
    // TODO: once Ad Server is ready, we should update this.
    return this.garmr.execute(() => {
      // return fetchParse(`${this.url}/private/campaign/${params.postId}/cancel`, {
      //   ...this.fetchOptions,
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ userId: params.userId }),
      // });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { postId, userId } = params;
      return Promise.resolve({
        success: true, // Mock response for testing
      });
    });
  }

  estimatePostBoostReach(params: {
    postId: string;
    userId: string;
    duration: number;
    budget: number;
  }): Promise<PostBoostReach> {
    // TODO: once Ad Server is ready, we should update this.
    return this.garmr.execute(() => {
      // return fetchParse(`${this.url}/private/campaign/estimate`, {
      //   ...this.fetchOptions,
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(params),
      // });

      // Mocking the response for testing purposes
      const baseReach = Math.floor(params.budget * params.duration * 0.1);
      const variance = Math.floor(baseReach * 0.2); // 20% variance

      return Promise.resolve({
        estimatedReach: {
          min: Math.max(0, baseReach - variance),
          max: baseReach + variance,
        },
      });
    });
  }

  // TODO: once Ad Server is ready, we should update this.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getCampaignById(props: GetCampaignByIdProps): Promise<PromotedPost> {
    // return this.garmr.execute(() => {
    // return fetchParse(`${this.url}/private/campaign/${id}`, {
    //   ...this.fetchOptions,
    // });
    // });
    return Promise.resolve({
      campaignId: 'mock-campaign-id',
      postId: 'mock-post-id',
      status: 'mock-status',
      budget: 'mock-budget',
      currentBudget: 'mock-current-budget',
      startedAt: new Date(),
      endedAt: new Date(),
      impressions: 100,
      clicks: 92,
    });
  }

  // TODO: once Ad Server is ready, we should update this.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getCampaigns(params: GetCampaignsProps): Promise<PromotedPostList> {
    return this.garmr.execute(() => {
      // return fetchParse(`${this.url}/private/campaigns`, {
      //   ...this.fetchOptions,
      // });
      return Promise.resolve({
        promotedPosts: [],
        impressions: 0,
        clicks: 0,
        totalSpend: 0,
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
