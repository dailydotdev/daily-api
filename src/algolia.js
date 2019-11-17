import algoliasearch from 'algoliasearch';
import config from './config';

let client;
let index;

const initAlgolia = (indexName) => {
  client = algoliasearch(config.algolia.app, config.algolia.key);
  index = client.initIndex(`${config.algolia.indexPrefix}_${indexName}`);
};

export const getPostsIndex = () => {
  if (!index) {
    initAlgolia('posts');
  }
  return index;
};

export const trackSearch = (trackingId, ip) => {
  if (client) {
    client.setExtraHeader('X-Algolia-UserToken', trackingId);
    client.setExtraHeader('X-Forwarded-For', ip);
  }
};
