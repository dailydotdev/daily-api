import { messageToJson, Worker } from './worker';
import { Source, SourceMember } from '../entity';
import { ChangeObject } from '../types';

interface Data {
  sourceMember: ChangeObject<SourceMember>;
}

const worker: Worker = {
  subscription: 'api.squad-activation',
  handler: async (message, con): Promise<void> => {
    const { sourceMember }: Data = messageToJson(message);
    const source = await con
      .getRepository(Source)
      .findOneBy({ id: sourceMember.sourceId });
    if (!source || source.type !== 'squad' || source.active) {
      return;
    }
    const membersCount = await con
      .getRepository(SourceMember)
      .countBy({ sourceId: source.id });
    if (membersCount >= 2) {
      await con
        .getRepository(Source)
        .update({ id: source.id }, { active: true });
    }
  },
};

export default worker;
