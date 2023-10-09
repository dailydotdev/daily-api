import retry, { OperationOptions } from 'retry';
import isNetworkError from './networkError';
import fetch, { RequestInfo, RequestInit, Response } from 'node-fetch';

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

export class HttpError extends Error {
  public url: string;
  public statusCode: number;
  public response: string;

  constructor(url: string, status: number, response: string) {
    super(`Unexpected status code: ${status}`);

    this.name = 'HttpError';
    this.url = url;
    this.statusCode = status;
    this.response = response;
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

export function retryFetch(
  url: RequestInfo,
  fetchOpts: RequestInit,
  retryOpts?: RetryOptions,
): Promise<Response> {
  return asyncRetry(async () => {
    const res = await fetch(url, fetchOpts);
    if (res.ok) {
      return res;
    }
    const err = new HttpError(url.toString(), res.status, await res.text());
    if (res.status < 500) {
      throw new AbortError(err);
    }
    throw err;
  }, retryOpts);
}

export async function retryFetchParse<T>(
  url: RequestInfo,
  fetchOpts: RequestInit,
  retryOpts?: RetryOptions,
): Promise<T> {
  const res = await retryFetch(url, fetchOpts, retryOpts);
  return res.json();
}
