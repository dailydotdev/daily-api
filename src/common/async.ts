import {
  circuitBreaker,
  ConsecutiveBreaker,
  ExponentialBackoff,
  handleAll,
  IFailureEvent,
  ISuccessEvent,
  retry,
  wrap,
} from 'cockatiel';

const DEFAULT_BATCH_LIMIT = 40_000; // postgresql params limit is around 65k, to be safe, let's run at 40k.

type ForceStop = boolean;

interface BlockingBatchRunnerOptions<T> {
  data: T[];
  batchLimit?: number;
  runner: (current: T[]) => Promise<ForceStop | void>;
}

export const blockingBatchRunner = async <T>({
  batchLimit = DEFAULT_BATCH_LIMIT,
  data,
  runner,
}: BlockingBatchRunnerOptions<T>) => {
  for (let i = 0; i < data.length; i += batchLimit) {
    const current = data.slice(i, i + batchLimit);
    const shouldStop = await runner(current);
    if (shouldStop) {
      break;
    }
  }
};

interface CallWithRetryDefaultProps {
  callback: () => Promise<unknown>;
  onSuccess?: (data: ISuccessEvent) => void;
  onFailure?: (err: IFailureEvent) => void;
}

export const callWithRetryDefault = ({
  callback,
  onFailure,
  onSuccess,
}: CallWithRetryDefaultProps) => {
  // Create a retry policy that'll try whatever function we execute 3
  // times with a randomized exponential backoff.
  const retryPolicy = retry(handleAll, {
    maxAttempts: 3,
    backoff: new ExponentialBackoff(),
  });

  if (onFailure) {
    retryPolicy.onFailure(onFailure);
  }

  if (onSuccess) {
    retryPolicy.onSuccess(onSuccess);
  }

  // Create a circuit breaker that'll stop calling the executed function for 10
  // seconds if it fails 5 times in a row. This can give time for e.g. a database
  // to recover without getting tons of traffic.
  const circuitBreakerPolicy = circuitBreaker(handleAll, {
    halfOpenAfter: 10 * 1000,
    breaker: new ConsecutiveBreaker(5),
  });

  // Combine these! Create a policy that retries 3 times, calling through the circuit breaker
  const retryWithBreaker = wrap(retryPolicy, circuitBreakerPolicy);

  return retryWithBreaker.execute(callback);
};
