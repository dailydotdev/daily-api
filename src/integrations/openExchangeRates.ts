import { env } from 'node:process';
import { ONE_HOUR_IN_SECONDS } from '../common';
import { logger } from '../logger';
import { getRedisHash, setRedisHashWithExpiry } from '../redis';
import { isNullOrUndefined } from '../common/object';
import { retryFetchParse } from './retry';
import { StorageKey } from '../config';

const REDIS_EXPIRATION = ONE_HOUR_IN_SECONDS;

const URL = 'https://openexchangerates.org/api/latest.json';

export type CurrencyRate = Record<string, string>;

export type OpenExchangeRates = {
  disclaimer: string;
  license: string;
  timestamp: number;
  base: string;
  rates: CurrencyRate;
};

export const getOpenExchangeRates = async (): Promise<CurrencyRate> => {
  if (!env.OPEN_EXCHANGE_RATES_APP_ID) {
    throw new Error('OPEN_EXCHANGE_RATES_APP_ID is not set');
  }

  const redisRates = await getRedisHash(StorageKey.OpenExchangeRates);
  if (redisRates && Object.keys(redisRates).length > 0) {
    return redisRates;
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
    await setRedisHashWithExpiry(
      StorageKey.OpenExchangeRates,
      data.rates,
      REDIS_EXPIRATION,
    );

    return data.rates;
  } catch (_err) {
    const err = _err as Error;
    logger.error({ err }, 'Error fetching open exchange rates');
    throw err;
  }
};

export const getExchangeRate = async (
  currency: string,
): Promise<number | null> => {
  const rates = await getOpenExchangeRates();
  const rate = rates?.[currency];
  if (isNullOrUndefined(rate)) {
    return null;
  }

  return parseFloat(rate);
};

export const convertCurrencyToUSD = async (
  amount: number,
  currency: string,
): Promise<number> => {
  const rate = await getExchangeRate(currency);
  if (isNullOrUndefined(rate)) {
    return 0;
  }

  return +(amount / rate).toFixed(2);
};
