import algoliasearch, { SearchClient, SearchIndex } from 'algoliasearch';

let client: SearchClient;
let index: SearchIndex;

const indexPrefix = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';

const initAlgolia = (indexName: string): void => {
  client = algoliasearch(process.env.ALGOLIA_APP, process.env.ALGOLIA_KEY);
  index = client.initIndex(`${indexPrefix}_${indexName}`);
};

export const getPostsIndex = (): SearchIndex => {
  if (!index) {
    initAlgolia('posts');
  }
  return index;
};

export const trackSearch = (
  trackingId: string,
  ip: string,
): Readonly<Record<string, string>> => ({
  'X-Algolia-UserToken': trackingId,
  'X-Forwarded-For': ip,
});
