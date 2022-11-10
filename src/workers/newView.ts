import { DataSource, DeepPartial } from 'typeorm';
import { View } from '../entity';
import { messageToJson, Worker } from './worker';

const ONE_WEEK = 604800000;

const addView = async (con: DataSource, entity: View): Promise<boolean> => {
  const repo = con.getRepository(View);
  const existing = await repo.findOne({
    where: {
      userId: entity.userId,
      postId: entity.postId,
    },
    order: { timestamp: 'DESC' },
  });
  if (
    !existing ||
    entity.timestamp.getTime() - existing.timestamp.getTime() > ONE_WEEK
  ) {
    await repo.save(entity);
    return true;
  }
  return false;
};

const worker: Worker = {
  subscription: 'add-views-v2',
  handler: async (message, con, logger): Promise<void> => {
    const data: DeepPartial<View> = messageToJson(message);
    try {
      const didSave = await addView(
        con,
        con.getRepository(View).create({
          postId: data.postId,
          userId: data.userId,
          referer: data.referer,
          timestamp: data.timestamp && new Date(data.timestamp as string),
        }),
      );
      if (!didSave) {
        logger.debug(
          {
            view: data,
            messageId: message.messageId,
          },
          'ignored view event',
        );
      }
    } catch (err) {
      // Foreign / unique
      if (err?.code === '23502' || err?.code === '23503') {
        return;
      }

      logger.error(
        {
          view: data,
          messageId: message.messageId,
          err,
        },
        'failed to add view event to db',
      );
      if (err.name === 'QueryFailedError') {
        return;
      }
      throw err;
    }
  },
};

export default worker;
