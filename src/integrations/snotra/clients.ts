import { ISnotraClient, UserStatePayload, UserStateResponse } from './types';
import { RequestInit } from 'node-fetch';
import { fetchOptions as globalFetchOptions } from '../../http';
import { retryFetchParse } from '../retry';

export class SnotraClient implements ISnotraClient {
  private readonly url: string;
  private readonly fetchOptions: RequestInit;

  constructor(
    url = process.env.SNOTRA_ORIGIN,
    fetchOptions: RequestInit = globalFetchOptions,
  ) {
    this.url = url;
    this.fetchOptions = fetchOptions;
  }

  fetchUserState(payload: UserStatePayload): Promise<UserStateResponse> {
    return retryFetchParse(
      `${this.url}/api/v1/user/profile`,
      {
        ...this.fetchOptions,
        method: 'POST',
        body: JSON.stringify(payload),
      },
      { retries: 5 },
    );
  }
}
