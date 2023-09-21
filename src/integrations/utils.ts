import pRetry, { AbortError } from 'p-retry';
import fetch, { RequestInit } from 'node-fetch';

export function retryFetch<T>(
  url: string,
  fetchOpts: RequestInit,
  retryOpts?: pRetry.Options,
): Promise<T> {
  return pRetry(async () => {
    const res = await fetch(url, fetchOpts);
    if (res.ok) {
      return res.json();
    }
    if (res.status < 500) {
      throw new AbortError(`request is invalid: ${res.status}`);
    }
    throw new Error(`unexpecetd response from feed service: ${res.status}`);
  }, retryOpts);
}
