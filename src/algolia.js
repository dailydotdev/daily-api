import algoliasearch from 'algoliasearch';
import config from './config';

// eslint-disable-next-line import/prefer-default-export
export const initAlgolia = (indexName, trackingId, ip) => {
  // TODO: init client according to user token and ip
  const client = algoliasearch(config.algolia.app, config.algolia.key);
  if (trackingId) {
    client.setExtraHeader('X-Algolia-UserToken', trackingId);
  }
  if (ip) {
    client.setExtraHeader('X-Forwarded-For', ip);
  }
  const index = client.initIndex(`${config.algolia.indexPrefix}_${indexName}`);
  return { client, index };
};
