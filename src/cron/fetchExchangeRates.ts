import { getOpenExchangeRates } from '../integrations/openExchangeRates';
import { logger } from '../logger';
import type { Cron } from './cron';

export const fetchExchangeRates: Cron = {
  name: 'fetch-exchange-rates',
  handler: async () => {
    logger.info('Fetching exchange rates');
    try {
      await getOpenExchangeRates();
    } catch (_err) {
      const err = _err as Error
      logger.error({ err },'Error fetching exchange rates');
    }
  },
};
