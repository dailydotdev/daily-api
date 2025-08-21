import { postMetricsUpdatedTopic } from '../../common/schema/topics';
import { PostAnalytics } from '../../entity/posts/PostAnalytics';
import type { TypedWorker } from '../worker';

export const postAnalyticsUpdate: TypedWorker<'api.v1.post-metrics-updated'> = {
  subscription: 'api.post-analytics-update',
  handler: async ({ data }, con): Promise<void> => {
    const { postId, payload } = data;

    if (!postId) {
      return;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    await con.getRepository(PostAnalytics).upsert(
      {
        id: postId,
        ...payload,
      },
      {
        conflictPaths: ['id'],
      },
    );
  },
  parseMessage: (message) => {
    return postMetricsUpdatedTopic.parse(message.data);
  },
};
