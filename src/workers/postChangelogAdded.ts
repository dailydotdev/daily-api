import { messageToJson, Worker } from './worker';
import { Post } from '../entity';
import { ChangeObject } from '../types';
import { setRedisObject } from '../redis';
import { REDIS_CHANGELOG_KEY } from '../config';

interface Data {
  post: ChangeObject<Post>;
}

const CHANGELOG_SOURCE_ID = 'daily_updates';

const worker: Worker = {
  subscription: 'api.post-changelog-added-v2',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    const { post } = data;
    if (post?.sourceId !== CHANGELOG_SOURCE_ID) {
      return;
    }
    try {
      const timestampMs = post.createdAt / 1000; // createdAt comes as μs here

      await setRedisObject(
        REDIS_CHANGELOG_KEY,
        new Date(timestampMs).toISOString(),
      );
    } catch (err) {
      logger.error(
        { data, messageId: message.messageId, err },
        'failed to set redis cache for post changelog',
      );
    }
  },
};

export default worker;
