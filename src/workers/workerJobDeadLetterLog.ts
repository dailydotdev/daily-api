import type { BaseTypedWorker } from './worker';

const worker: BaseTypedWorker<unknown> = {
  subscription: 'api.worker-job-execute-dead-letter-log',
  handler: async ({ messageId, data }, con, logger) => {
    logger.info(
      {
        data,
        messageId,
      },
      'worker-job dead message, hel awaits',
    );
  },
};

export default worker;
