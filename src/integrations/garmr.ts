import {
  bulkhead,
  circuitBreaker,
  ConstantBackoff,
  FailureReason,
  handleAll,
  IDefaultPolicyContext,
  IPolicy,
  noop,
  Policy,
  retry,
  SamplingBreaker,
  wrap,
} from 'cockatiel';
import { logger } from '../logger';
import { isTest } from '../common';

export class GarmrService {
  instance: IPolicy;

  constructor({
    service,
    handler,
    breakerOpts,
    retryOpts,
    limits,
  }: {
    service: string;
    handler?: Policy;
    breakerOpts: {
      halfOpenAfter: number;
      threshold: number;
      duration: number;
      minimumRps?: number;
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
    // in testing we avoid the circuit breaker logic due to repeatable nature
    if (isTest) {
      this.instance = noop;

      return;
    }

    const retryPolicy = retry(handleAll, {
      maxAttempts: retryOpts?.maxAttempts ?? 2,
      backoff: new ConstantBackoff(retryOpts?.timeout ?? 100),
    });

    const bulkheadPolicy = bulkhead(
      limits?.maxRequests ?? 1000,
      limits?.queuedRequests ?? 0,
    );

    const commonLoggerData = {
      service,
    };

    const circuitBreakerPolicy = circuitBreaker(handler ?? handleAll, {
      halfOpenAfter: breakerOpts.halfOpenAfter,
      breaker: new SamplingBreaker({
        threshold: breakerOpts.threshold,
        duration: breakerOpts.duration,
        minimumRps: breakerOpts.minimumRps ?? 5,
      }),
    });
    circuitBreakerPolicy.onBreak((event: FailureReason<Error>) => {
      logger.warn(
        {
          ...commonLoggerData,
          event,
        },
        'circuit breaker opened',
      );
    });
    circuitBreakerPolicy.onHalfOpen(() => {
      logger.info(commonLoggerData, 'circuit breaker half-opened');
    });
    circuitBreakerPolicy.onReset(() => {
      logger.info(commonLoggerData, 'circuit breaker reset');
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
