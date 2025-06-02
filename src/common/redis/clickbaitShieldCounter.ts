import { RedisCounter } from './redisCounters';

const keyPrefix = 'clickbait-shield';
const MAX_TRIES = 5;

function getSecondsUntilEndOfMonth(): number {
  const now = new Date();
  const endOfMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1,
    0,
    0,
    0,
    0,
  );
  return Math.floor((endOfMonth.getTime() - now.getTime()) / 1000);
}

const counter = new RedisCounter(keyPrefix);

export async function hasTriesLeft(userId: string): Promise<boolean> {
  const used = await counter.get(userId);
  return used < MAX_TRIES;
}

export async function tryIncrement(userId: string): Promise<boolean> {
  const used = await counter.get(userId);
  if (used < MAX_TRIES) {
    const expiration = getSecondsUntilEndOfMonth();
    await counter.increment({ userId, expiration });
    return true;
  }
  return false;
}
