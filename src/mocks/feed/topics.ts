import type { FeedTopic } from '../../integrations/feed/types';

const MOCK_CLUSTER_SIZE = 2;

export const mockTopicsResponse = (allowedTags: string[]): FeedTopic[] => {
  const topics: FeedTopic[] = [];

  for (let i = 0; i < allowedTags.length; i += MOCK_CLUSTER_SIZE) {
    const tags = allowedTags.slice(i, i + MOCK_CLUSTER_SIZE);

    topics.push({ label: tags[0], tags });
  }

  return topics;
};
