import { IAutomationService } from './types';
import { RequestInit } from 'node-fetch';
import { fetchOptions as globalFetchOptions } from '../../http';
import { retryFetchParse } from '../retry';

export class RetoolAutomationService<Args, Ret> implements IAutomationService<
  Args,
  Ret
> {
  constructor(
    private readonly url: string,
    private readonly fetchOptions: RequestInit = globalFetchOptions,
  ) {}

  async run(args: Args): Promise<Ret> {
    return retryFetchParse<Ret>(
      this.url,
      {
        ...this.fetchOptions,
        method: 'POST',
        body: JSON.stringify(args),
      },
      { retries: 1 },
    );
  }
}
