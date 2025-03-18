import { getOpenExchangeRates } from '../integrations/openExchangeRates';
import { logger } from '../logger';
import type { Cron } from './cron';

export const fetchExchangeRates: Cron = {
  name: 'fetch-exchange-rates',
  handler: async () => {
    logger.info('Fetching exchange rates');
    getOpenExchangeRates();
  },
};
