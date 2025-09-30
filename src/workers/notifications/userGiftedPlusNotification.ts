import { NotificationType } from '../../notifications/common';
import { NotificationGiftPlusContext } from '../../notifications';
import { SquadSource, User, UserSubscriptionFlags } from '../../entity';
import { isGiftedPlus, isPlusMember } from '../../paddle';
import { queryReadReplica } from '../../common/queryReadReplica';
import { PLUS_MEMBER_SQUAD_ID } from '../userUpdatedPlusSubscriptionSquad';
import { CioTransactionalMessageTemplateId, sendEmail } from '../../common';
import { logger } from '../../logger';
import { TypedNotificationWorker } from '../worker';

async function sendNotificationEmailToGifter(ctx: NotificationGiftPlusContext) {
  const message_data = {
    recipient_name: ctx.recipient.name,
    recipient_image: ctx.recipient.image,
  };

  await sendEmail({
    send_to_unsubscribed: true,
    identifiers: { id: ctx.gifter.id },
    transactional_message_id:
      CioTransactionalMessageTemplateId.UserSentPlusGift,
    to: ctx.gifter.email,
    message_data,
  });
}

const worker: TypedNotificationWorker<'user-updated'> = {
  subscription: 'api.user-gifted-plus-notification',
  handler: async ({ user, newProfile: recipient }, con) => {
    const beforeSubscriptionFlags: Partial<UserSubscriptionFlags> = JSON.parse(
      (user.subscriptionFlags as string) || '{}',
    );
    const afterSubscriptionFlags: Partial<UserSubscriptionFlags> = JSON.parse(
      (recipient.subscriptionFlags as string) || '{}',
    );

    if (!isGiftedPlus(afterSubscriptionFlags)) {
      return;
    }

    if (
      isPlusMember(beforeSubscriptionFlags?.cycle) ||
      !afterSubscriptionFlags?.gifterId
    ) {
      logger.warn(
        {
          user,
          beforeSubscriptionFlags,
          afterSubscriptionFlags,
        },
        'Invalid user-gifted-plus-notification',
      );
      return;
    }

    const [gifter, squad] = await queryReadReplica(con, ({ queryRunner }) => {
      return Promise.all([
        queryRunner.manager.getRepository(User).findOne({
          where: { id: afterSubscriptionFlags.gifterId },
        }),
        queryRunner.manager.getRepository(SquadSource).findOne({
          where: { id: PLUS_MEMBER_SQUAD_ID },
        }),
      ]);
    });

    if (!gifter || !squad) {
      return;
    }

    const sharedCtx: Omit<NotificationGiftPlusContext, 'userIds'> = {
      gifter,
      recipient,
      squad,
    };

    const gifterCtx: NotificationGiftPlusContext = {
      ...sharedCtx,
      userIds: [gifter.id],
    };
    const recipientCtx: NotificationGiftPlusContext = {
      ...sharedCtx,
      userIds: [recipient.id],
    };

    console.log('Gifting plus to', {
      gifterCtx,
      recipientCtx,
    });

    await sendNotificationEmailToGifter(gifterCtx);

    return [
      { type: NotificationType.UserGiftedPlus, ctx: gifterCtx },
      { type: NotificationType.UserGiftedPlus, ctx: recipientCtx },
    ];
  },
};

export default worker;
