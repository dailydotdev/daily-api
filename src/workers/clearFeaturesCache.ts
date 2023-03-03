import { Worker } from './worker';
import { deleteKeysByPattern } from '../redis';
import { getFeaturesKey } from '../flagsmith';

const worker: Worker = {
  subscription: 'api.clear-features-cache',
  handler: async (message, con, log) => {
    log.info('clearing features cache');
    await deleteKeysByPattern(getFeaturesKey('*'));
  },
};

export default worker;
