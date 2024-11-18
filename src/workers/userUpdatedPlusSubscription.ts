import { ghostUser } from '../common';
import { TypedWorker } from './worker';
import { addNewSourceMember } from '../schema/sources';
import { SourceMemberRoles } from '../roles';
import { User } from '../entity';

const PLUS_MEMBER_SQUAD_ID = '05862288-bace-4723-9218-d30fab6ae96d';
const worker: TypedWorker<'user-updated'> = {
  subscription: 'api.user-updated-plus-subscribed',
  handler: async (message, con, log) => {
    const {
      data: { newProfile: user, user: oldUser },
    } = message;

    const beforeFlags = JSON.parse(
      (oldUser.subscriptionFlags as string) || '{}',
    ) as User['subscriptionFlags'];
    const afterFlags = JSON.parse(
      (user.subscriptionFlags as string) || '{}',
    ) as User['subscriptionFlags'];

    if (
      user.id === ghostUser.id ||
      !user.infoConfirmed ||
      !!beforeFlags?.cycle
    ) {
      return;
    }

    if (afterFlags?.cycle === beforeFlags?.cycle) {
      return;
    }

    const member = {
      sourceId: PLUS_MEMBER_SQUAD_ID,
      userId: user.id,
      role: SourceMemberRoles.Member,
    };
    await addNewSourceMember(con, member);
    log.info({ userId: user.id }, 'added user to plus member squad');
  },
};

export default worker;
