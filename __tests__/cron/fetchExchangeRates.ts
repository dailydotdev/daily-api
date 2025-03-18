import nock from 'nock';

import { fetchExchangeRates as cron } from '../../src/cron/fetchExchangeRates';
import { env } from 'node:process';
import {
  deleteRedisKey,
  getRedisHash,
  setRedisHashWithExpiry,
} from '../../src/redis';
import { StorageKey } from '../../src/config';
import { ONE_DAY_IN_SECONDS } from '../../src/common';
import { expectSuccessfulCron } from '../helpers';

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

describe('fetchExchangeRates cron', () => {
  it('it should fetch exchange rates and store it in redis', async () => {
    expect(await getRedisHash(StorageKey.OpenExchangeRates)).toEqual({});

    nock(mockedURL)
      .get('/api/latest.json')
      .query({
        app_id: env.OPEN_EXCHANGE_RATES_APP_ID,
      })
      .reply(200, mockedResponse);

    await expectSuccessfulCron(cron);

    expect(await getRedisHash(StorageKey.OpenExchangeRates)).toEqual({
      USD: '1',
      NOK: '10.5',
      EUR: '0.9',
      GBP: '0.8',
    });
  });

  it('it should update exchange rates', async () => {
    await setRedisHashWithExpiry(
      StorageKey.OpenExchangeRates,
      {
        USD: '1',
        NOK: '9.23',
        EUR: '0.86',
        GBP: '0.81',
      },
      ONE_DAY_IN_SECONDS,
    );

    expect(await getRedisHash(StorageKey.OpenExchangeRates)).toEqual({
      USD: '1',
      NOK: '9.23',
      EUR: '0.86',
      GBP: '0.81',
    });

    nock(mockedURL)
      .get('/api/latest.json')
      .query({
        app_id: env.OPEN_EXCHANGE_RATES_APP_ID,
      })
      .reply(200, mockedResponse);

    await expectSuccessfulCron(cron);

    expect(await getRedisHash(StorageKey.OpenExchangeRates)).toEqual({
      USD: '1',
      NOK: '10.5',
      EUR: '0.9',
      GBP: '0.8',
    });
  });
});
