import {
  checkRedisObjectExists,
  deleteRedisKey,
  setRedisObjectIfNotExistsWithExpiry,
  setRedisObjectWithExpiry,
} from '../redis';

export const withRedisDoneLock = async ({
  doneKey,
  lockKey,
  lockValue,
  lockTtlSeconds,
  doneTtlSeconds,
  execute,
}: {
  doneKey: string;
  lockKey: string;
  lockValue: string;
  lockTtlSeconds: number;
  doneTtlSeconds: number;
  execute: () => Promise<void>;
}): Promise<boolean> => {
  if (await checkRedisObjectExists(doneKey)) {
    return false;
  }

  const lockAcquired = await setRedisObjectIfNotExistsWithExpiry(
    lockKey,
    lockValue,
    lockTtlSeconds,
  );
  if (!lockAcquired) {
    return false;
  }

  try {
    await execute();
    await setRedisObjectWithExpiry(doneKey, '1', doneTtlSeconds);
    return true;
  } finally {
    await deleteRedisKey(lockKey);
  }
};
