import { messageToJson, Worker } from './worker';
import { ChangeObject } from '../types';
import { SourceMember, Feature } from '../entity';

interface Data {
  sourceMember: ChangeObject<SourceMember>;
}

const worker: Worker = {
  subscription: 'api.squad-feature-access',
  handler: async (message, con): Promise<void> => {
    const { sourceMember: member }: Data = messageToJson(message);

    console.log('gained squad access');

    const hasAccess = await con.getRepository(Feature).findOneBy({
      feature: 'squad',
      userId: member.userId,
    });

    if (hasAccess) {
      console.log('found one', hasAccess);
      return;
    }

    console.log('should insert!');

    await con.getRepository(Feature).insert({
      feature: 'squad',
      userId: member.userId,
    });
  },
};

export default worker;
