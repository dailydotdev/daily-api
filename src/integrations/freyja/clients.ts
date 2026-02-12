import type { RequestInit } from 'undici';
import { IFreyjaClient, type FunnelState } from './types';
import { GarmrNoopService, IGarmrService, GarmrService } from '../garmr';
import { fetchOptions as globalFetchOptions } from '../../http';
import { fetchParse } from '../retry';

export class FreyjaClient implements IFreyjaClient {
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

  createSession(
    userId: string,
    funnelId: string,
    version?: number,
  ): Promise<FunnelState> {
    return this.garmr.execute(() => {
      return fetchParse(`${this.url}/api/sessions`, {
        ...this.fetchOptions,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, funnelId, version }),
      });
    });
  }

  getSession(sessionId: string): Promise<FunnelState> {
    return this.garmr.execute(() => {
      return fetchParse(`${this.url}/api/sessions/${sessionId}`, {
        ...this.fetchOptions,
        method: 'GET',
      });
    });
  }
}

const garmrFreyjaService = new GarmrService({
  service: FreyjaClient.name,
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
  },
});

export const freyjaClient = new FreyjaClient(process.env.FREYJA_ORIGIN!, {
  garmr: garmrFreyjaService,
});
