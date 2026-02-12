import type { RequestInit } from 'undici';
import { GarmrNoopService, IGarmrService, GarmrService } from '../garmr';
import { fetchOptions as globalFetchOptions } from '../../http';
import { retryFetchParse } from '../retry';
import { ISnotraClient, ProfileRequest, ProfileResponse } from './types';
import {
  isMockEnabled,
  mockSnotraEngagementProfile,
} from '../../mocks/opportunity/services';

export class SnotraClient implements ISnotraClient {
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

  getProfile(request: ProfileRequest): Promise<ProfileResponse> {
    // Mock path: return mock engagement profile
    if (isMockEnabled()) {
      return Promise.resolve(mockSnotraEngagementProfile);
    }

    return this.garmr.execute(() => {
      return retryFetchParse<ProfileResponse>(
        `${this.url}/api/v1/memstore/shortprofile`,
        {
          ...this.fetchOptions,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        },
      );
    });
  }
}

const garmrSnotraService = new GarmrService({
  service: SnotraClient.name,
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
  },
});

export const snotraClient = new SnotraClient(process.env.SNOTRA_ORIGIN!, {
  garmr: garmrSnotraService,
});
