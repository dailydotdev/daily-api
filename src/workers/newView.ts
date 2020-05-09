import { PubSub, Message } from '@google-cloud/pubsub';
import { Logger } from 'fastify';
import { Connection, DeepPartial } from 'typeorm';
import { View } from '../entity';

const env = process.env.NODE_ENV || 'development';
const topicName = 'views';
const subName = `add-views-v2${env === 'production' ? '' : `-${env}`}`;

const ONE_WEEK = 604800000;

const addView = async (con: Connection, entity: View): Promise<boolean> => {
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

export const newViewWorker = async (
  pubsub: PubSub,
  con: Connection,
  logger: Logger,
): Promise<void> => {
  const topic = pubsub.topic(topicName);
  const subscription = topic.subscription(subName);
  if (subscription.get) {
    await subscription.get({ autoCreate: true });
  }
  logger.info(`waiting for messages in ${topicName}`);
  subscription.on(
    'message',
    async (message: Message): Promise<void> => {
      const data: DeepPartial<View> = JSON.parse(message.data.toString());
      try {
        const didSave = await addView(
          con,
          con.getRepository(View).create({
            ...data,
            timestamp: new Date(data.timestamp as string),
          }),
        );
        if (didSave) {
          logger.info(
            {
              view: data,
              messageId: message.id,
            },
            'added successfully view event',
          );
        } else {
          logger.debug(
            {
              view: data,
              messageId: message.id,
            },
            'ignored view event',
          );
        }
        message.ack();
      } catch (err) {
        logger.error(
          {
            view: data,
            messageId: message.id,
            err,
          },
          'failed to add view event to db',
        );
        if (err.name === 'QueryFailedError') {
          message.ack();
        } else {
          message.nack();
        }
      }
    },
  );
};
