import retry, { OperationOptions } from 'retry';
import isNetworkError from './networkError';
import { fetch, type RequestInit, type Response } from 'undici';
import { runInSpan } from '../telemetry';
import { trace } from '@opentelemetry/api';
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_URL_FULL,
} from '@opentelemetry/semantic-conventions';
import { Message, type JsonValue } from '@bufbuild/protobuf';
import { isTest } from '../common';

export class AbortError extends Error {
  public originalError: Error;

  constructor(message: Error | string) {
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
      if (attempt > 1) {
        trace.getActiveSpan()?.addEvent('retry_attempt', {
          'retry.attempt': attempt,
        });
      }
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
  url: string | URL,
  fetchOpts: RequestInit,
  retryOpts?: RetryOptions,
): Promise<Response> {
  return runInSpan('retryFetch', async (span) =>
    asyncRetry(async () => {
      const res = await fetch(url, fetchOpts);
      span.setAttributes({
        [ATTR_URL_FULL]: url.toString(),
        [ATTR_HTTP_RESPONSE_STATUS_CODE]: res.status,
        [ATTR_HTTP_REQUEST_METHOD]: fetchOpts.method,
      });
      if (res.ok) {
        return res;
      }
      const err = new HttpError(url.toString(), res.status, await res.text());
      if (res.status < 500) {
        span.recordException(err);
        throw new AbortError(err);
      }
      throw err;
    }, retryOpts),
  );
}

export async function retryFetchParse<T>(
  url: string | URL,
  fetchOpts: RequestInit,
  retryOpts?: RetryOptions,
): Promise<T> {
  const res = await retryFetch(url, fetchOpts, retryOpts);
  return res.json() as Promise<T>;
}

export async function fetchParse<T>(
  url: string | URL,
  fetchOpts: RequestInit,
): Promise<T> {
  return runInSpan('fetchParse', async (span) => {
    span.setAttributes({
      [ATTR_URL_FULL]: url.toString(),
      [ATTR_HTTP_REQUEST_METHOD]: fetchOpts.method,
    });
    const res = await fetch(url, fetchOpts);
    span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, res.status);
    return res.json() as T;
  });
}

export async function fetchParseBinary<T extends Message<T>>(
  url: string | URL,
  fetchOpts: RequestInit,
  parser: T,
): Promise<T> {
  return runInSpan('fetchParseBinary', async (span) => {
    span.setAttributes({
      [ATTR_URL_FULL]: url.toString(),
      [ATTR_HTTP_REQUEST_METHOD]: fetchOpts.method,
    });
    const res = await fetch(url, fetchOpts);
    span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, res.status);
    if (isTest) {
      // Jest only support mocks of JSON
      return parser.fromJson((await res.json()) as JsonValue);
    }

    const binaryResult = new Uint8Array(await res.arrayBuffer());
    return parser.fromBinary(binaryResult);
  });
}
