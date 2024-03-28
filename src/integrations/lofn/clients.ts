import {
  ILofnClient,
  LofnFeedConfigPayload,
  LofnFeedConfigResponse,
} from './types';
import { RequestInit } from 'node-fetch';
import { fetchOptions as globalFetchOptions } from '../../http';
import { retryFetchParse } from '../retry';

export class LofnClient implements ILofnClient {
  private readonly url: string;
  private readonly fetchOptions: RequestInit;

  constructor(
    url = process.env.LOFN_ORIGIN,
    fetchOptions: RequestInit = globalFetchOptions,
  ) {
    this.url = url;
    this.fetchOptions = fetchOptions;
  }

  fetchConfig(payload: LofnFeedConfigPayload): Promise<LofnFeedConfigResponse> {
    return retryFetchParse(
      `${this.url}/config`,
      {
        ...this.fetchOptions,
        method: 'POST',
        body: JSON.stringify(payload),
      },
      { retries: 5 },
    );
  }
}
