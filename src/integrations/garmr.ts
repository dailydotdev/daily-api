import {
  bulkhead,
  circuitBreaker,
  ConstantBackoff,
  handleAll,
  IDefaultPolicyContext,
  IPolicy,
  Policy,
  retry,
  SamplingBreaker,
  wrap,
} from 'cockatiel';

export class GarmrService {
  instance: IPolicy;

  constructor({
    handler,
    breakerOpts,
    retryOpts,
    limits,
  }: {
    handler?: Policy;
    breakerOpts: {
      halfOpenAfter: number;
      threshold: number;
      duration: number;
    };
    retryOpts?: {
      maxAttempts: number;
      timeout: number;
    };
    limits?: {
      maxRequests: number;
      queuedRequests?: number;
    };
  }) {
    const retryPolicy = retry(handleAll, {
      maxAttempts: retryOpts?.maxAttempts ?? 2,
      backoff: new ConstantBackoff(retryOpts?.timeout ?? 100),
    });

    const bulkheadPolicy = bulkhead(
      limits?.maxRequests ?? 1000,
      limits?.queuedRequests ?? 0,
    );

    const circuitBreakerPolicy = circuitBreaker(handler ?? handleAll, {
      halfOpenAfter: breakerOpts.halfOpenAfter,
      breaker: new SamplingBreaker({
        threshold: breakerOpts.threshold,
        duration: breakerOpts.duration,
      }),
    });

    this.instance = wrap(retryPolicy, circuitBreakerPolicy, bulkheadPolicy);
  }

  execute<T>(
    fn: (context: IDefaultPolicyContext) => PromiseLike<T> | T,
    signal?: AbortSignal,
  ): Promise<T> {
    return this.instance.execute(fn, signal);
  }
}

export interface IGarmrClient {
  garmr: GarmrService;
}
