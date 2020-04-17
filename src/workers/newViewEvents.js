import { PubSub } from '@google-cloud/pubsub';
import config from '../config';
import logger from '../logger';
import event from '../models/event';

const pubsub = new PubSub();

const topicName = 'views';
const subName = `add-views${config.env === 'production' ? '' : `-${config.env}`}`;

const topic = pubsub.topic(topicName);
const subscription = topic.subscription(subName);

const addEvent = data =>
  event.add('view', data.userId, data.postId, data.referer, data.agent, data.ip, new Date(data.timestamp))
    .catch((err) => {
      if (err.code === 'ER_DUP_ENTRY') {
        return;
      }

      throw err;
    });

export default () => subscription.get({ autoCreate: true })
  .then(() => {
    logger.info(`waiting for messages in ${topicName}`);
    subscription.on('message', (message) => {
      const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
      addEvent(data)
        .then(() => {
          logger.info({ view: data }, 'added successfully view event');
          message.ack();
        })
        .catch((err) => {
          logger.error({ view: data, err }, 'failed to add view event to db');
          message.nack();
        });
    });
  });
