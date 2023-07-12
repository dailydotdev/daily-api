import { messageToJson, Worker } from './worker';
import { Post, Source } from '../entity';
import { ChangeObject } from '../types';
import { updateFlagsStatement } from '../common';

interface Data {
  source: ChangeObject<Source>;
}

const worker: Worker = {
  subscription: 'api.source-privacy-updated',
  handler: async (message, con, logger): Promise<void> => {
    const { source }: Data = messageToJson(message);
    try {
      await con.getRepository(Post).update(
        {
          sourceId: source.id,
        },
        {
          private: source.private,
          flags: updateFlagsStatement<Post>({ private: source.private }),
        },
      );
      logger.info(
        {
          sourceId: source.id,
          messageId: message.messageId,
        },
        'updated source posts privacy',
      );
    } catch (err) {
      logger.error(
        {
          sourceId: source.id,
          messageId: message.messageId,
          err,
        },
        'failed to trigger updating source privacy',
      );
      throw err;
    }
  },
};

export default worker;
