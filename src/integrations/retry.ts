import retry, { OperationOptions } from 'retry';
import isNetworkError from './networkError';
import fetch, { RequestInit } from 'node-fetch';

export class AbortError extends Error {
  public originalError: Error;

  constructor(message) {
    super();

    if (message instanceof Error) {
      this.originalError = message;
      message = message.message;
    } else {
      this.originalError = new Error(message);
      this.originalError.stack = this.stack;
    }

    this.name = 'AbortError';
    this.message = message;
  }
}

export type RetryOptions = OperationOptions;

export async function asyncRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const operation = retry.operation({
      retries: 5,
      randomize: true,
      minTimeout: 100,
      ...options,
    });

    operation.attempt(async (attempt) => {
      try {
        const result = await fn(attempt);
        resolve(result);
      } catch (err) {
        try {
          if (!(err instanceof Error)) {
            throw new TypeError(
              `Non-error was thrown: "${err}". You should only throw errors.`,
            );
          }

          if (err instanceof AbortError) {
            throw err.originalError;
          }

          if (err instanceof TypeError && !isNetworkError(err)) {
            throw err;
          }

          if (!operation.retry(err)) {
            throw operation.mainError();
          }
        } catch (finalError) {
          reject(finalError);
        }
      }
    });
  });
}

export function retryFetch<T>(
  url: string,
  fetchOpts: RequestInit,
  retryOpts?: RetryOptions,
): Promise<T> {
  return asyncRetry(async () => {
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
