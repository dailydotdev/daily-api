const DEFAULT_BATCH_LIMIT = 40_000; // postgresql limit is around 65k, to be safe, let's run at 40k.

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
