import { TypedWorker } from './worker';
import { Decoration, User, UserDecoration } from '../entity';
import { hasPlusStatusChanged } from '../paddle';
import { queryReadReplica } from '../common/queryReadReplica';
import { ghostUser } from '../common';
import { In } from 'typeorm';

const worker: TypedWorker<'user-updated'> = {
  subscription: 'api.user-updated-plus-subscription-decoration',
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

    const { isPlus, wasPlus, statusChanged } = hasPlusStatusChanged(
      afterFlags,
      beforeFlags,
    );

    if (!statusChanged || isPlus || !wasPlus) {
      return;
    }

    // Get all subscriber decorations
    const subscriberDecorations = await queryReadReplica(
      con,
      ({ queryRunner }) =>
        queryRunner.manager.getRepository(Decoration).find({
          where: { decorationGroup: 'subscriber' },
          select: ['id'],
        }),
    );

    const subscriberDecorationIds = subscriberDecorations.map((d) => d.id);

    if (subscriberDecorationIds.length === 0) {
      return;
    }

    // Remove all subscriber decorations from user
    const { affected: deletedCount } = await con
      .getRepository(UserDecoration)
      .delete({
        userId: user.id,
        decorationId: In(subscriberDecorationIds),
      });

    // Clear activeDecorationId if it was a subscriber decoration
    if (
      user.activeDecorationId &&
      subscriberDecorationIds.includes(user.activeDecorationId)
    ) {
      await con
        .getRepository(User)
        .update({ id: user.id }, { activeDecorationId: null });
    }

    const hadActiveSubscriberDecoration =
      user.activeDecorationId &&
      subscriberDecorationIds.includes(user.activeDecorationId);

    log.info(
      {
        userId: user.id,
        deletedDecorations: deletedCount,
        clearedActiveDecoration: hadActiveSubscriberDecoration,
      },
      'cleared subscriber decorations after Plus expiry',
    );
  },
};

export default worker;
