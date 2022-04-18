import {
  ReputationEvent,
  ReputationReason,
  ReputationType,
} from '../entity/ReputationEvent';
import { messageToJson, Worker } from './worker';
import { SourceRequest } from '../entity';
import { ChangeObject } from '../types';

interface Data {
  type: string;
  pubRequest: ChangeObject<SourceRequest>;
}

const worker: Worker = {
  subscription: 'pub-request-rep',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);

    if (data.type !== 'approve') {
      return;
    }

    const { id, userId } = data.pubRequest;
    try {
      const repo = con.getRepository(ReputationEvent);
      const event = repo.create({
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
