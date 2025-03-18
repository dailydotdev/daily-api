import { env } from 'node:process';
import { ONE_DAY_IN_SECONDS } from '../common';
import { logger } from '../logger';
import { getRedisHashField, setRedisHashWithExpiry } from '../redis';
import { isNullOrUndefined } from '../common/object';
import { retryFetchParse } from './retry';

const REDIS_KEY = 'openExchangeRates';
const REDIS_EXPIRATION = ONE_DAY_IN_SECONDS;

const URL = 'https://openexchangerates.org/api/latest.json';

export type CurrencyRate = Record<string, number>;

export type OpenExchangeRates = {
  disclaimer: string;
  license: string;
  timestamp: number;
  base: string;
  rates: CurrencyRate;
};

export const getExchangeRate = async (
  currency: string,
): Promise<number | null> => {
  const rate = await getRedisHashField(REDIS_KEY, currency);
  if (isNullOrUndefined(rate)) {
    return null;
  }

  return parseFloat(rate);
};

export const getOpenExchangeRates = async (): Promise<void> => {
  if (!env.OPEN_EXCHANGE_RATES_APP_ID) {
    throw new Error('OPEN_EXCHANGE_RATES_APP_ID is not set');
  }

  try {
    const params = new URLSearchParams({
      app_id: env.OPEN_EXCHANGE_RATES_APP_ID,
    });
    const data = await retryFetchParse<OpenExchangeRates>(
      `${URL}?${params}`,
      {},
      {
        retries: 3,
      },
    );
    await setRedisHashWithExpiry(REDIS_KEY, data.rates, REDIS_EXPIRATION);
  } catch (_err) {
    const err = _err as Error;
    logger.error({ err }, 'Error fetching open exchange rates');
  }
};
