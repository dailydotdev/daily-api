import {
  ILofnClient,
  LofnFeedConfigPayload,
  LofnFeedConfigResponse,
} from './types';
import type { RequestInit } from 'undici';
import { fetchOptions as globalFetchOptions } from '../../http';
import { fetchParse } from '../retry';
import { GarmrNoopService, IGarmrClient, IGarmrService } from '../garmr';

export class LofnClient implements ILofnClient, IGarmrClient {
  private readonly url: string;
  private readonly fetchOptions: RequestInit;
  readonly garmr: IGarmrService;

  constructor(
    url = process.env.LOFN_ORIGIN,
    options?: {
      fetchOptions?: RequestInit;
      garmr?: IGarmrService;
    },
  ) {
    const {
      fetchOptions = globalFetchOptions,
      garmr = new GarmrNoopService(),
    } = options || {};

    this.url = url;
    this.fetchOptions = fetchOptions;
    this.garmr = garmr;
  }

  fetchConfig(payload: LofnFeedConfigPayload): Promise<LofnFeedConfigResponse> {
    return this.garmr.execute(() => {
      return fetchParse(`${this.url}/config`, {
        ...this.fetchOptions,
        method: 'POST',
        body: JSON.stringify(payload),
      });
    });
  }
}
