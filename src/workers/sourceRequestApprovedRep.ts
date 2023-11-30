import { ReputationEvent, ReputationReason, ReputationType } from '../entity';
import { TypedWorker } from './worker';
import { NotificationReason } from '../common';

const worker: TypedWorker<'pub-request'> = {
  subscription: 'pub-request-rep',
  handler: async (message, con, logger): Promise<void> => {
    const { data } = message;
    const { reason, sourceRequest } = data;

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
