import {
  Notification,
  NotificationAttachment,
  NotificationAvatar,
} from '../entity';
import { DeepPartial, EntityManager } from 'typeorm';
import { NotificationBuilder } from './builder';
import { NotificationBaseContext, NotificationBundle } from './types';
import { generateNotificationMap, notificationTitleMap } from './generate';
import { NotificationType } from './common';

export * from './types';
export function generateNotification(
  type: NotificationType,
  ctx: NotificationBaseContext,
): NotificationBundle {
  const builder = NotificationBuilder.new(type, ctx.userId).title(
    notificationTitleMap[type](ctx),
  );
  return generateNotificationMap[type](builder, ctx).build();
}

const concatNotificationChildren = <
  T extends DeepPartial<{ notificationId: string }>,
>(
  array: T[],
  notificationId: string,
  newItems: T[],
): T[] =>
  array.concat(
    newItems.map((item) => ({
      ...item,
      notificationId,
    })),
  );

export async function storeNotificationBundle(
  entityManager: EntityManager,
  bundles: NotificationBundle[],
): Promise<{ id: string }[]> {
  const { identifiers } = await entityManager
    .createQueryBuilder()
    .insert()
    .into(Notification)
    .values(bundles.map(({ notification }) => notification))
    .orIgnore()
    .execute();
  let attachments: DeepPartial<NotificationAttachment>[] = [];
  let avatars: DeepPartial<NotificationAvatar>[] = [];
  for (let i = 0; i < identifiers.length && i < bundles.length; i++) {
    // If the notification was not ignored due to duplication
    if (identifiers[i]) {
      if (bundles[i].attachments) {
        attachments = concatNotificationChildren(
          attachments,
          identifiers[i].id,
          bundles[i].attachments,
        );
      }
      if (bundles[i].avatars) {
        avatars = concatNotificationChildren(
          avatars,
          identifiers[i].id,
          bundles[i].avatars,
        );
      }
    }
  }
  await Promise.all([
    entityManager.insert(NotificationAttachment, attachments),
    entityManager.insert(NotificationAvatar, avatars),
  ]);
  return identifiers as { id: string }[];
}
