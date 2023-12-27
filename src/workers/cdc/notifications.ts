import { messageToJson, Worker } from '../worker';
import { ChangeMessage } from '../../types';
import { getTableName } from './common';
import { NotificationV2 } from '../../entity';
import { DataSource } from 'typeorm';
import { FastifyBaseLogger } from 'fastify';
import { notifyNewNotification } from '../../common';

const onNotificationsChange = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  data: ChangeMessage<NotificationV2>,
): Promise<void> => {
  if (data.payload.op === 'c') {
    await notifyNewNotification(logger, data.payload.after);
  }
};

const worker: Worker = {
  subscription: 'api.cdc-notifications',
  maxMessages: parseInt(process.env.CDC_WORKER_MAX_MESSAGES) || null,
  handler: async (message, con, logger): Promise<void> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: ChangeMessage<any> = messageToJson(message);
      if (
        data.schema.name === 'io.debezium.connector.common.Heartbeat' ||
        data.payload.op === 'r'
      ) {
        return;
      }
      switch (data.payload.source.table) {
        case getTableName(con, NotificationV2):
          await onNotificationsChange(con, logger, data);
          break;
      }
    } catch (err) {
      logger.error(
        {
          messageId: message.messageId,
          err,
        },
        'failed to handle notification cdc message',
      );
      throw err;
    }
  },
};

export default worker;
