import PubSub from '@google-cloud/pubsub';
import _ from 'lodash';
import config from '../config';
import logger from '../logger';
import post from '../models/post';

const pubsub = new PubSub();

const topicName = 'post-image-processed';
const subName = `add-post-to-db${config.env === 'production' ? '' : `-${config.env}`}`;

const topic = pubsub.topic(topicName);
const subscription = topic.subscription(subName);

const addPost = data =>
  post.add(data)
    .catch((err) => {
      if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return logger.warn(`publication id ${data.publicationId} does not exist`);
      }

      if (err.code === 'ER_DUP_ENTRY') {
        return logger.info(`post ${data.id} already exists`);
      }

      if (err.code === 'ER_TRUNCATED_WRONG_VALUE') {
        return addPost(Object.assign({}, data, { publishedAt: null }));
      }

      if (err.code === 'ER_DATA_TOO_LONG') {
        if (err.sqlMessage.indexOf('tag') > -1) {
          return addPost(Object.assign({}, data, { tags: [] }));
        }

        if (err.sqlMessage.indexOf('url') > -1) {
          return logger.warn(`url is too long ${data.url}`);
        }

        if (err.sqlMessage.indexOf('title') > -1) {
          return logger.warn(`title is too long ${data.title}`);
        }
      }

      throw err;
    });

export default () => subscription.get({ autoCreate: true })
  .then(() => {
    logger.info(`waiting for messages in ${topicName}`);
    subscription.on('message', (message) => {
      const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
      logger.info({ post: data }, `adding post ${data.id} to db`);
      data.publishedAt = new Date(data.publishedAt);
      data.createdAt = new Date();
      const props = ['id', 'title', 'url', 'publicationId', 'publishedAt', 'createdAt', 'image', 'ratio', 'placeholder', 'tags', 'siteTwitter', 'creatorTwitter', 'readTime'];
      addPost(_.pick(data, props))
        .then(() => {
          logger.info({ post: data }, `added successfully post ${data.id}`);
          message.ack();
        })
        .catch((err) => {
          logger.error({ post: data, err }, 'failed to add post to db');
          message.nack();
        });
    });
  });
