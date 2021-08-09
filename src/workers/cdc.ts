import { messageToJson, Worker } from './worker';
import { SourceRequest } from '../entity';
import {
  addOrRemoveSuperfeedrSubscription,
  notifySourceRequest,
} from '../common';
import { ChangeMessage } from '../types';
import { Connection } from 'typeorm';
import { Logger } from 'fastify';

const onSourceRequestChange = async (
  con: Connection,
  logger: Logger,
  data: ChangeMessage<SourceRequest>,
): Promise<void> => {
  if (data.payload.op === 'c') {
    // New source request
    await notifySourceRequest(logger, 'new', data.payload.after);
  } else if (data.payload.op === 'u') {
    if (!data.payload.before.closed && data.payload.after.closed) {
      if (data.payload.after.approved) {
        // Source request published
        await addOrRemoveSuperfeedrSubscription(
          data.payload.after.sourceFeed,
          data.payload.after.sourceId,
          'subscribe',
        );
        await notifySourceRequest(logger, 'publish', data.payload.after);
      } else {
        // Source request declined
        await notifySourceRequest(logger, 'decline', data.payload.after);
      }
    } else if (!data.payload.before.approved && data.payload.after.approved) {
      // Source request approved
      await notifySourceRequest(logger, 'approve', data.payload.after);
    }
  }
};

const worker: Worker = {
  subscription: 'cdc',
  handler: async (message, con, logger): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: ChangeMessage<any> = messageToJson(message);
    switch (data.payload.source.table) {
      case 'source_request':
        await onSourceRequestChange(con, logger, data);
        break;
    }
  },
};

export default worker;
