import { ghostUser } from '../common';
import { TypedWorker } from './worker';
import { addNewSourceMember, removeSourceMember } from '../schema/sources';
import { SourceMemberRoles } from '../roles';
import { SourceMember, User } from '../entity';
import { queryReadReplica } from '../common/queryReadReplica';
import { isPlusMember } from '../paddle';

export const PLUS_MEMBER_SQUAD_ID = '05862288-bace-4723-9218-d30fab6ae96d';
const worker: TypedWorker<'user-updated'> = {
  subscription: 'api.user-updated-plus-subscribed-squad',
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

    if (user.id === ghostUser.id || !user.infoConfirmed) {
      return;
    }

    const isPlus = isPlusMember(afterFlags?.cycle);
    const wasPlus = isPlusMember(beforeFlags?.cycle);
    if (isPlus === wasPlus) {
      return;
    }

    if (!isPlus) {
      // Stopped being plus member remove them
      await removeSourceMember({
        con,
        userId: user.id,
        sourceId: PLUS_MEMBER_SQUAD_ID,
      });
      log.info({ userId: user.id }, 'removed user from plus member squad');
    } else {
      // Started being plus member add them
      const check = await queryReadReplica(con, ({ queryRunner }) => {
        return queryRunner.manager.getRepository(SourceMember).findOne({
          where: {
            userId: user.id,
            sourceId: PLUS_MEMBER_SQUAD_ID,
          },
        });
      });
      if (check) {
        log.info({ userId: user.id }, 'user was already in plus member squad');
        return;
      }
      const member = {
        sourceId: PLUS_MEMBER_SQUAD_ID,
        userId: user.id,
        role: SourceMemberRoles.Member,
      };
      await addNewSourceMember(con, member);
      log.info({ userId: user.id }, 'added user to plus member squad');
    }
  },
};

export default worker;
