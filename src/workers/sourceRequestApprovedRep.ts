import {
  ReputationEvent,
  ReputationReason,
  ReputationType,
} from '../entity/ReputationEvent';
import { messageToJson, Worker } from './worker';
import { SourceRequest } from '../entity';
import { ChangeObject } from '../types';

interface Data {
  request: ChangeObject<SourceRequest>;
}

const worker: Worker = {
  subscription: 'source-request-approved-rep',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    const { id, userId } = data.request;
    try {
      const repo = con.getRepository(ReputationEvent);
      const event = repo.create({
        grantById: '',
        grantToId: userId,
        targetId: id,
        targetType: ReputationType.Source,
        reason: ReputationReason.SourceRequestApproved,
      });
      await repo
        .createQueryBuilder()
        .insert()
        .values(event)
        .orIgnore()
        .execute();

      logger.info(
        { data, messageId: message.messageId },
        'increased reputation due to source request being approved',
      );
    } catch (err) {
      logger.error(
        { data, messageId: message.messageId, err },
        'failed to increase reputation due to source request being approved',
      );
    }
  },
};

export default worker;
