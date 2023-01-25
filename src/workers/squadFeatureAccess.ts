import { messageToJson, Worker } from './worker';
import { ChangeObject } from '../types';
import { SourceMember, Feature, FeatureType } from '../entity';

interface Data {
  sourceMember: ChangeObject<SourceMember>;
}

const worker: Worker = {
  subscription: 'api.squad-feature-access',
  handler: async (message, con): Promise<void> => {
    const { sourceMember: member }: Data = messageToJson(message);
    const variables = {
      feature: FeatureType.Squad,
      userId: member.userId,
    };
    const hasAccess = await con.getRepository(Feature).findOneBy(variables);

    if (hasAccess) {
      return;
    }

    await con.getRepository(Feature).insert(variables);
  },
};

export default worker;
