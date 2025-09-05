import { ghostUser, isTest } from '../common';
import { TypedWorker } from './worker';
import { Feed, User } from '../entity';
import { queryReadReplica } from '../common/queryReadReplica';
import { remoteConfig } from '../remoteConfig';
import { isPlusMember } from '../paddle';

const worker: TypedWorker<'user-updated'> = {
  subscription: 'api.user-updated-plus-subscribed-custom-feed',
  handler: async (message, con, log) => {
    if (!remoteConfig.vars.plusCustomFeed && !isTest) {
      return;
    }

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
    if (isPlus === wasPlus || !isPlus) {
      return;
    }

    // Started being plus member create custom feed
    const cfid = `cf-${user.id}`;
    const check = await queryReadReplica(con, ({ queryRunner }) => {
      return queryRunner.manager.getRepository(Feed).findOne({
        where: {
          userId: user.id,
          id: cfid,
        },
      });
    });
    if (check) {
      log.info({ userId: user.id }, 'user already has this custom feed');
      return;
    }

    await con.getRepository(Feed).save({
      id: cfid,
      userId: user.id,
      flags: {
        name: 'My new feed',
        icon: '🤓',
      },
    });
    log.info({ userId: user.id }, 'added custom feed for plus user');
  },
};

export default worker;
