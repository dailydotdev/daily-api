import { ReputationEvent, ReputationReason, ReputationType } from '../entity';
import { messageToJson, Worker } from './worker';
import { SourceRequest } from '../entity';
import { NotificationReason } from '../common';

interface Data {
  reason: NotificationReason;
  sourceRequest: Pick<SourceRequest, 'id' | 'userId'>;
}

const worker: Worker = {
  subscription: 'pub-request-rep',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    const { reason, sourceRequest }: Data = messageToJson(message);

    if (reason !== NotificationReason.Publish) {
      return;
    }

    const { id, userId } = sourceRequest;
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
