import { env } from 'node:process';
import { ONE_DAY_IN_SECONDS } from '../common';
import { logger } from '../logger';
import { getRedisHashField, setRedisHashWithExpiry } from '../redis';
import { isNullOrUndefined } from '../common/object';
import { retryFetchParse } from './retry';
import { StorageKey } from '../config';

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
  const rate = await getRedisHashField(StorageKey.OpenExchangeRates, currency);
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
    await setRedisHashWithExpiry(
      StorageKey.OpenExchangeRates,
      data.rates,
      REDIS_EXPIRATION,
    );
  } catch (_err) {
    const err = _err as Error;
    logger.error({ err }, 'Error fetching open exchange rates');
  }
};

export const convertCurrencyToUSD = async (
  amount: number,
  currency: string,
): Promise<number | null> => {
  const rate = await getExchangeRate(currency);
  if (isNullOrUndefined(rate)) {
    return null;
  }

  return +(amount / rate).toFixed(2);
};
