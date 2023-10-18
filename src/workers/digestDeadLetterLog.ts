import { messageToJson, Worker } from './worker';

type Data = unknown;

const worker: Worker = {
  subscription: 'api.personalized-digest-email-dead-letter-log',
  handler: async (message, con, logger) => {
    const data = messageToJson<Data>(message);

    logger.info(
      {
        data,
        messageId: message.messageId,
      },
      'dead message, hel awaits',
    );
  },
};

export default worker;
