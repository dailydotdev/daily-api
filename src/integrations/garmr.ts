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
import { counters } from '../telemetry/metrics';

export interface IGarmrService {
  readonly instance: IPolicy;

  execute<T>(
    fn: (context: IDefaultPolicyContext) => PromiseLike<T> | T,
    signal?: AbortSignal,
  ): Promise<T>;
}

/**
 * Placeholder empty service for clients not yet using Garmr
 *
 * @export
 * @class GarmrNoopService
 * @implements {IGarmrService}
 */
export class GarmrNoopService implements IGarmrService {
  readonly instance: IPolicy = noop;

  execute<T>(
    fn: (context: IDefaultPolicyContext) => PromiseLike<T> | T,
    signal?: AbortSignal,
  ): Promise<T> {
    return this.instance.execute(fn, signal);
  }
}

export class GarmrService implements IGarmrService {
  readonly instance: IPolicy;

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
      backoff?: number;
    };
    limits?: {
      maxRequests: number;
      queuedRequests?: number;
    };
  }) {
    // in testing we avoid the breaker logic due to repeatable nature
    if (isTest) {
      this.instance = noop;

      return;
    }

    const retryPolicy = retry(handleAll, {
      maxAttempts: retryOpts?.maxAttempts ?? 2,
      backoff: new ConstantBackoff(retryOpts?.backoff ?? 100),
    });

    retryPolicy.onRetry((event: FailureReason<unknown>) => {
      logger.debug(
        {
          ...commonLoggerData,
          event,
        },
        'retrying request',
      );

      counters?.['personalized-digest']?.garmrRetry?.add(1, {
        service: commonLoggerData.service,
      });
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
        'breaker opened',
      );

      counters?.['personalized-digest']?.garmrBreak?.add(1, {
        service: commonLoggerData.service,
      });
    });
    circuitBreakerPolicy.onHalfOpen(() => {
      logger.info(commonLoggerData, 'breaker half-opened');

      counters?.['personalized-digest']?.garmrHalfOpen?.add(1, {
        service: commonLoggerData.service,
      });
    });
    circuitBreakerPolicy.onReset(() => {
      logger.info(commonLoggerData, 'breaker reset');

      counters?.['personalized-digest']?.garmrReset?.add(1, {
        service: commonLoggerData.service,
      });
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
  readonly garmr: IGarmrService;
}
