import {
  Notification,
  NotificationAttachment,
  NotificationAttachmentV2,
  NotificationAvatar,
  NotificationAvatarV2,
  NotificationV2,
} from '../entity';
import { DeepPartial, EntityManager } from 'typeorm';
import { NotificationBuilder } from './builder';
import {
  NotificationBaseContext,
  NotificationBundle,
  NotificationBundleV2,
} from './types';
import { generateNotificationMap, notificationTitleMap } from './generate';
import { NotificationType } from './common';
import { UserNotification } from '../entity/notifications/UserNotification';
import { NotificationHandlerReturn } from '../workers/notifications/worker';
import { EntityTarget } from 'typeorm/common/EntityTarget';

export * from './types';

export function generateNotification(
  type: NotificationType,
  ctx: NotificationBaseContext,
): NotificationBundle[] {
  return ctx.userIds.map((userId) => {
    const builder = NotificationBuilder.new(type, [userId]).title(
      notificationTitleMap[type](ctx),
    );
    return generateNotificationMap[type](builder, ctx).build();
  });
}

export function generateNotificationV2(
  type: NotificationType,
  ctx: NotificationBaseContext,
): NotificationBundleV2 {
  const builder = NotificationBuilder.new(type, ctx.userIds).title(
    notificationTitleMap[type](ctx),
  );
  return generateNotificationMap[type](builder, ctx).buildV2();
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

export async function generateAndStoreNotifications(
  entityManager: EntityManager,
  args: NotificationHandlerReturn,
): Promise<{ id: string }[]> {
  const bundles = args.flatMap(({ type, ctx }) =>
    generateNotification(type, ctx),
  );
  return storeNotificationBundle(entityManager, bundles);
}

/**
 * PG doesn't return the id of existing records, only new ones. I had to write this query to get around that.
 * Major assumption here is that every column value is a string, hence I didn't turn it into a generic function.
 * I adjusted the answer below to keep the order of the records.
 * See more here: https://stackoverflow.com/a/42217872/2650104
 */
const upsertAndReturnIds = async <Entity>(
  entityManager: EntityManager,
  entity: EntityTarget<Entity>,
  cols: (keyof DeepPartial<Entity>)[],
  unique: (keyof DeepPartial<Entity>)[],
  records: DeepPartial<Entity>[],
): Promise<string[]> => {
  if (!records.length) {
    return [];
  }
  const table = entityManager.getRepository(entity).metadata.tableName;
  const colsStr = cols.map((col) => `"${col.toString()}"`).join(',');
  const uniqueStr = unique.map((col) => `"${col.toString()}"`).join(',');
  const values = records
    .map(
      (rec, index) =>
        `(${index}, ${cols.map((col) => `'${rec[col]}'`).join(',')})`,
    )
    .join(',');
  const res = await entityManager.query(`
    with new_values (i, ${colsStr}) as (values ${values}),
         ins as (
    insert
    into ${table} (${colsStr})
    select ${colsStr}
    from new_values on conflict do nothing
      returning id, ${uniqueStr}
   ), recs as (
    select id, ${uniqueStr}
    from ins
    union all
    select id, ${uniqueStr}
    from ${table}
      join new_values using (${uniqueStr})
   )
   select id
   from new_values
   join recs using (${uniqueStr})
   order by i;
  `);
  return res.map(({ id }) => id);
};

async function upsertAvatarsV2(
  entityManager: EntityManager,
  avatars: NotificationBundleV2['avatars'],
): Promise<string[]> {
  return upsertAndReturnIds(
    entityManager,
    NotificationAvatarV2,
    ['type', 'name', 'image', 'targetUrl', 'referenceId'],
    ['type', 'referenceId'],
    avatars,
  );
}

async function upsertAttachments(
  entityManager: EntityManager,
  attachments: NotificationBundleV2['attachments'],
): Promise<string[]> {
  return upsertAndReturnIds(
    entityManager,
    NotificationAttachmentV2,
    ['type', 'image', 'title', 'referenceId'],
    ['type', 'referenceId'],
    attachments,
  );
}

export async function storeNotificationBundleV2(
  entityManager: EntityManager,
  bundle: NotificationBundleV2,
): Promise<string> {
  const [avatars, attachments] = await Promise.all([
    upsertAvatarsV2(entityManager, bundle.avatars || []),
    upsertAttachments(entityManager, bundle.attachments || []),
  ]);
  const notification = await entityManager.getRepository(NotificationV2).save({
    ...bundle.notification,
    avatars,
    attachments,
  });

  await entityManager
    .createQueryBuilder()
    .insert()
    .into(UserNotification)
    .values(
      bundle.userIds.map((userId) => ({
        userId,
        notificationId: notification.id,
        createdAt: notification.createdAt,
        public: notification.public,
      })),
    )
    .execute();
  return notification.id;
}

export async function generateAndStoreNotificationsV2(
  entityManager: EntityManager,
  args: NotificationHandlerReturn,
): Promise<string[]> {
  return Promise.all(
    args.map(({ type, ctx }) => {
      const bundle = generateNotificationV2(type, ctx);
      return storeNotificationBundleV2(entityManager, bundle);
    }),
  );
}
