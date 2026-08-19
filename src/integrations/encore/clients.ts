import fetch, { RequestInit } from 'node-fetch';
import type {
  EncoreOffersFeedRequest,
  EncoreOffersFeedResponse,
  IEncoreClient,
} from './types';
import { GarmrNoopService, GarmrService, IGarmrService } from '../garmr';
import { fetchOptions as globalFetchOptions } from '../../http';
import { HttpError } from '../retry';

export class EncoreClient implements IEncoreClient {
  private readonly fetchOptions: RequestInit;
  private readonly garmr: IGarmrService;

  constructor(
    private readonly url: string,
    private readonly apiKey: string,
    private readonly clientId: string,
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

  private async request<T>(
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    if (!this.url || !this.apiKey) {
      throw new Error('Missing ENCORE_ORIGIN or ENCORE_API_KEY');
    }

    return this.garmr.execute(async ({ signal }) => {
      const response = await fetch(`${this.url}${path}`, {
        ...this.fetchOptions,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        throw new HttpError(
          `${this.url}${path}`,
          response.status,
          await response.text(),
        );
      }

      return response.json() as Promise<T>;
    });
  }

  getOffersFeed(
    request: EncoreOffersFeedRequest,
  ): Promise<EncoreOffersFeedResponse> {
    return this.request('/offers/feed', {
      clientId: this.clientId,
      ...request,
    });
  }

  async confirmDelivered(
    impressionUid: string,
    deliveredTimestamp: number,
  ): Promise<void> {
    await this.request(
      `/offers/impressions/${encodeURIComponent(impressionUid)}/delivered`,
      { deliveredTimestamp },
    );
  }
}

const garmrEncoreService = new GarmrService({
  service: EncoreClient.name,
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
  },
  retryOpts: {
    maxAttempts: 1,
  },
  // Offers gate a milestone popup the user is waiting on — better to fall
  // back to the classic popup than to hang the moment.
  timeoutMs: 2 * 1000,
});

export const encoreClient = new EncoreClient(
  process.env.ENCORE_ORIGIN ?? '',
  process.env.ENCORE_API_KEY ?? '',
  process.env.ENCORE_CLIENT_ID ?? 'daily.dev',
  { garmr: garmrEncoreService },
);
