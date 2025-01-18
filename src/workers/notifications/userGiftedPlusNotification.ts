import { NotificationType } from '../../notifications/common';
import { generateTypedNotificationWorker } from './worker';
import { NotificationGiftPlusContext } from '../../notifications';
import { User, UserSubscriptionFlags } from '../../entity';
import { isGiftedPlus, isPlusMember } from '../../paddle';
import { queryReadReplica } from '../../common/queryReadReplica';

const worker = generateTypedNotificationWorker<'user-updated'>({
  subscription: 'api.user-gifted-plus-notification',
  handler: async ({ user, newProfile: recipient }, con) => {
    const { id: userId } = user;

    const beforeSubscriptionFlags: Partial<UserSubscriptionFlags> = JSON.parse(
      (user.subscriptionFlags as string) || '{}',
    );
    const afterSubscriptionFlags: Partial<UserSubscriptionFlags> = JSON.parse(
      (recipient.subscriptionFlags as string) || '{}',
    );

    if (
      isPlusMember(beforeSubscriptionFlags?.cycle) ||
      !isGiftedPlus(afterSubscriptionFlags) ||
      !afterSubscriptionFlags?.gifterId
    ) {
      return;
    }

    const gifter = await queryReadReplica(con, ({ queryRunner }) => {
      return queryRunner.manager.getRepository(User).findOneOrFail({
        where: { id: afterSubscriptionFlags.gifterId },
      });
    });

    const ctx: NotificationGiftPlusContext = {
      userIds: [userId],
      gifter,
      subscriptionFlags: afterSubscriptionFlags,
    };

    return [{ type: NotificationType.UserGiftedPlus, ctx }];
  },
});

export default worker;
