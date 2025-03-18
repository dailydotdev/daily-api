import nock from 'nock';

import {
  convertCurrencyToUSD,
  getExchangeRate,
  getOpenExchangeRates,
} from '../../src/integrations/openExchangeRates';
import { env } from 'node:process';
import { deleteRedisKey, getRedisHash } from '../../src/redis';
import { StorageKey } from '../../src/config';

const mockedURL = 'https://openexchangerates.org';

beforeEach(async () => {
  jest.clearAllMocks();
  nock.cleanAll();
  await deleteRedisKey(StorageKey.OpenExchangeRates);
});

const mockedResponse = {
  disclaimer: 'Usage subject to terms: https://openexchangerates.org/terms',
  license: 'https://openexchangerates.org/license',
  timestamp: 1742295600,
  base: 'USD',
  rates: {
    USD: 1,
    NOK: 10.5,
    EUR: 0.9,
    GBP: 0.8,
  },
};

describe('openExchangeRates', () => {
  describe('getOpenExchangeRates', () => {
    it('it should fetch exchange rates and store it in redis', async () => {
      expect(await getRedisHash(StorageKey.OpenExchangeRates)).toEqual({});

      nock(mockedURL)
        .get('/api/latest.json')
        .query({
          app_id: env.OPEN_EXCHANGE_RATES_APP_ID,
        })
        .reply(200, mockedResponse);

      await getOpenExchangeRates();

      expect(await getRedisHash(StorageKey.OpenExchangeRates)).toEqual({
        USD: '1',
        NOK: '10.5',
        EUR: '0.9',
        GBP: '0.8',
      });
    });
  });

  describe('getExchangeRate', () => {
    it('it should return the exchange rate for a given currency', async () => {
      nock(mockedURL)
        .get('/api/latest.json')
        .query({
          app_id: env.OPEN_EXCHANGE_RATES_APP_ID,
        })
        .reply(200, mockedResponse);

      await getOpenExchangeRates();

      const rate = await getExchangeRate('NOK');

      expect(rate).toEqual(10.5);
    });

    it('it should return null if the currency is not found', async () => {
      nock(mockedURL)
        .get('/api/latest.json')
        .query({
          app_id: env.OPEN_EXCHANGE_RATES_APP_ID,
        })
        .reply(200, mockedResponse);

      await getOpenExchangeRates();

      const rate = await getExchangeRate('INVALID');

      expect(rate).toBeNull();
    });

    it('it should return null if the currency is not found - missing from redis', async () => {
      const rate = await getExchangeRate('INVALID');

      expect(rate).toBeNull();
    });
  });

  describe('convertCurrencyToUSD', () => {
    it('it should convert currency to USD', async () => {
      nock(mockedURL)
        .get('/api/latest.json')
        .query({
          app_id: env.OPEN_EXCHANGE_RATES_APP_ID,
        })
        .reply(200, mockedResponse);

      await getOpenExchangeRates();

      const converted = await convertCurrencyToUSD(100, 'NOK');
      expect(converted).toEqual(9.52);
    });

    it('it should return null if the currency is not found', async () => {
      nock(mockedURL)
        .get('/api/latest.json')
        .query({
          app_id: env.OPEN_EXCHANGE_RATES_APP_ID,
        })
        .reply(200, mockedResponse);

      await getOpenExchangeRates();

      const converted = await convertCurrencyToUSD(100, 'WOLOLO');

      expect(converted).toBeNull();
    });
  });
});
