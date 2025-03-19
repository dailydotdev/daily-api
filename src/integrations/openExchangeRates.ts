import { env } from 'node:process';
import { ONE_HOUR_IN_SECONDS } from '../common';
import { getRedisHash, setRedisHashWithExpiry } from '../redis';
import { isNullOrUndefined } from '../common/object';
import { fetchParse } from './retry';
import { StorageKey } from '../config';
import { GarmrService } from './garmr';

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

const garmOpenExchangeRates = new GarmrService({
  service: 'openExchangeRates',
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.5,
    duration: 10 * 1000,
    minimumRps: 0,
  },
});

export const getOpenExchangeRates = async (): Promise<CurrencyRate> => {
  if (!env.OPEN_EXCHANGE_RATES_APP_ID) {
    throw new Error('OPEN_EXCHANGE_RATES_APP_ID is not set');
  }

  const redisRates = await getRedisHash(StorageKey.OpenExchangeRates);
  if (redisRates && Object.keys(redisRates).length > 0) {
    return redisRates;
  }

  const fetchedRates = await garmOpenExchangeRates.execute(async () => {
    const params = new URLSearchParams({
      app_id: env.OPEN_EXCHANGE_RATES_APP_ID!,
    });
    const data = await fetchParse<OpenExchangeRates>(`${URL}?${params}`, {});
    await setRedisHashWithExpiry(
      StorageKey.OpenExchangeRates,
      data.rates,
      REDIS_EXPIRATION,
    );

    return data.rates;
  });

  return fetchedRates || {};
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
