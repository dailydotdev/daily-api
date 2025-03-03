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
import { isTest } from '../common/utils';

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

type GarmrMeta = {
  service: string;
};

export class GarmrService implements IGarmrService {
  readonly instance: IPolicy;

  constructor({
    service,
    handler,
    breakerOpts,
    retryOpts,
    limits,
    events,
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
    events?: Partial<{
      onBreak?: (props: {
        event: FailureReason<Error>;
        meta: GarmrMeta;
      }) => void;
      onHalfOpen?: (props: { meta: GarmrMeta }) => void;
      onReset?: (props: { meta: GarmrMeta }) => void;
      onRetry?: (props: {
        event: FailureReason<unknown>;
        meta: GarmrMeta;
      }) => void;
    }>;
  }) {
    // in testing we avoid the breaker logic due to repeatable nature
    if (isTest) {
      this.instance = noop;

      return;
    }

    const instanceMeta: GarmrMeta = {
      service,
    };

    const retryPolicy = retry(handleAll, {
      maxAttempts: retryOpts?.maxAttempts ?? 2,
      backoff: new ConstantBackoff(retryOpts?.backoff ?? 100),
    });

    retryPolicy.onRetry((event: FailureReason<unknown>) => {
      logger.debug(
        {
          ...instanceMeta,
          event,
        },
        'retrying request',
      );

      events?.onRetry?.({ event, meta: instanceMeta });
    });

    const bulkheadPolicy = bulkhead(
      limits?.maxRequests ?? Infinity,
      limits?.queuedRequests ?? 0,
    );

    const circuitBreakerPolicy = circuitBreaker(handler ?? handleAll, {
      halfOpenAfter: breakerOpts.halfOpenAfter,
      breaker: new SamplingBreaker({
        threshold: breakerOpts.threshold,
        duration: breakerOpts.duration,
        minimumRps: breakerOpts.minimumRps ?? 5,
      }),
    });
    circuitBreakerPolicy.onBreak((originalEvent) => {
      const event = originalEvent as FailureReason<Error>;

      logger.warn(
        {
          ...instanceMeta,
          event,
        },
        'breaker opened',
      );

      events?.onBreak?.({ event, meta: instanceMeta });
    });
    circuitBreakerPolicy.onHalfOpen(() => {
      logger.info(instanceMeta, 'breaker half-opened');

      events?.onHalfOpen?.({ meta: instanceMeta });
    });
    circuitBreakerPolicy.onReset(() => {
      logger.info(instanceMeta, 'breaker reset');

      events?.onReset?.({ meta: instanceMeta });
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
