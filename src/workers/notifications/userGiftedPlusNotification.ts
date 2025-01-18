import { NotificationType } from '../../notifications/common';
import { generateTypedNotificationWorker } from './worker';
import { NotificationGiftPlusContext } from '../../notifications';
import { User, UserSubscriptionFlags } from '../../entity';
import { isGiftedPlus, isPlusMember } from '../../paddle';

const worker = generateTypedNotificationWorker<'user-updated'>({
  subscription: 'api.user-gifted-plus-notification',
  handler: async ({ user, newProfile }, con) => {
    const { id: userId } = user;

    const beforeSubscriptionFlags: Partial<UserSubscriptionFlags> = JSON.parse(
      (user.subscriptionFlags as string) || '{}',
    );
    const afterSubscriptionFlags: Partial<UserSubscriptionFlags> = JSON.parse(
      (newProfile.subscriptionFlags as string) || '{}',
    );

    if (
      isPlusMember(beforeSubscriptionFlags?.cycle) ||
      !isGiftedPlus(afterSubscriptionFlags) ||
      !afterSubscriptionFlags?.gifterId
    ) {
      return;
    }

    const gifterId = afterSubscriptionFlags.gifterId;
    const { username } = await con
      .getRepository(User)
      .findOneByOrFail({ id: gifterId });

    const ctx: NotificationGiftPlusContext = {
      userIds: [userId, gifterId],
      gifter: { id: gifterId, username },
      recipient: { id: userId, username: newProfile.username },
    };

    return [{ type: NotificationType.UserGiftedPlus, ctx }];
  },
});

export default worker;
