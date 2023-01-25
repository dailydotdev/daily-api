import { messageToJson, Worker } from './worker';
import { ChangeObject } from '../types';
import { SourceMember, Feature, FeatureType } from '../entity';
import { TypeOrmError } from '../errors';

interface Data {
  sourceMember: ChangeObject<SourceMember>;
}

const worker: Worker = {
  subscription: 'api.squad-feature-access',
  handler: async (message, con, logger): Promise<void> => {
    const { sourceMember: member }: Data = messageToJson(message);
    try {
      await con.getRepository(Feature).insert({
        feature: FeatureType.Squad,
        userId: member.userId,
      });
    } catch (err) {
      console.log(err.code);
      logger.error(
        {
          member,
          messageId: message.messageId,
          err,
        },
        'failed to give user squad feature access',
      );
      // Query failed or status is duplicate
      if (err.code === TypeOrmError.DUPLICATE_ENTRY) {
        return;
      }
      throw err;
    }
  },
};

export default worker;
