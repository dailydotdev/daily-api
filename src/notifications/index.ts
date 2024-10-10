import {
  NotificationAttachmentV2,
  NotificationAvatarV2,
  NotificationV2,
  UserNotification,
} from '../entity';
import { DeepPartial, EntityManager, ObjectLiteral } from 'typeorm';
import { NotificationBuilder } from './builder';
import { NotificationBaseContext, NotificationBundleV2 } from './types';
import { generateNotificationMap, notificationTitleMap } from './generate';
import { generateUserNotificationUniqueKey, NotificationType } from './common';
import { NotificationHandlerReturn } from '../workers/notifications/worker';
import { EntityTarget } from 'typeorm/common/EntityTarget';
import { logger } from '../logger';

export * from './types';

export function generateNotificationV2(
  type: NotificationType,
  ctx: NotificationBaseContext,
): NotificationBundleV2 {
  const builder = NotificationBuilder.new(type, ctx.userIds).title(
    notificationTitleMap[type](ctx as never)!,
  );
  return generateNotificationMap[type](builder, ctx as never).buildV2();
}

/**
 * PG doesn't return the id of existing records, only new ones. I had to write this query to get around that.
 * Major assumption here is that every column value is a string, hence I didn't turn it into a generic function.
 * I adjusted the answer below to keep the order of the records.
 * See more here: https://stackoverflow.com/a/42217872/2650104
 */
const upsertAndReturnIds = async <Entity extends ObjectLiteral>(
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
  const paramsPerRow = cols.length + 1;
  const parametrizedValues = records
    .map(
      (_, index) =>
        `(${new Array(paramsPerRow)
          .fill(0)
          .map((_, i) => `$${index * paramsPerRow + i + 1}`)
          .join(',')})`,
    )
    .join(',');
  const params = records.flatMap((rec, index) => [
    index,
    ...cols.map((col) => rec[col]),
  ]);
  const res = await entityManager.query(
    `
      with new_values (i, ${colsStr}) as (values ${parametrizedValues}),
           ins as (
      insert
      into ${table} (${colsStr})
      select ${colsStr}
      from new_values on conflict do nothing
      returning id, ${uniqueStr}
        )
         , recs as (
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
    `,
    params,
  );
  return res.map(({ id }: { id: string }) => id);
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
    avatars || [],
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
    attachments || [],
  );
}

export async function storeNotificationBundleV2(
  entityManager: EntityManager,
  bundle: NotificationBundleV2,
): Promise<{ id: string }[]> {
  const [avatars, attachments] = await Promise.all([
    upsertAvatarsV2(entityManager, bundle.avatars || []),
    upsertAttachments(entityManager, bundle.attachments || []),
  ]);

  logger.info(
    {
      notification: bundle.notification,
      avatars: bundle.avatars,
      attachments: bundle.attachments,
    },
    'debug notif - created notification avatars/attachments',
  );

  const { identifiers, generatedMaps } = await entityManager
    .createQueryBuilder()
    .insert()
    .into(NotificationV2)
    .values({
      ...bundle.notification,
      avatars,
      attachments,
    })
    .returning('*')
    .orIgnore()
    .execute();

  logger.info(
    {
      notification: bundle.notification,
      avatars: bundle.avatars,
      attachments: bundle.attachments,
    },
    'debug notif - created notification',
  );

  if (!generatedMaps?.[0]?.id) {
    return [];
  }

  const notification = generatedMaps[0] as NotificationV2;
  const uniqueKey = generateUserNotificationUniqueKey(notification);

  const chunks: Pick<
    UserNotification,
    'userId' | 'notificationId' | 'createdAt' | 'public' | 'uniqueKey'
  >[][] = [];
  const chunkSize = 500;

  bundle.userIds.forEach((userId) => {
    if (chunks.length === 0 || chunks[chunks.length - 1].length === chunkSize) {
      chunks.push([]);
    }

    chunks[chunks.length - 1].push({
      userId,
      notificationId: notification.id,
      createdAt: notification.createdAt,
      public: notification.public,
      uniqueKey,
    });
  });

  for (const chunk of chunks) {
    await entityManager
      .createQueryBuilder()
      .insert()
      .into(UserNotification)
      .values(chunk)
      // onConflict deprecated (but still usable) because no way to use orIgnore with where clause
      // https://github.com/typeorm/typeorm/issues/8124#issuecomment-1523780405
      .onConflict(
        '("userId", "uniqueKey") WHERE "uniqueKey" IS NOT NULL DO NOTHING',
      )
      .execute();
  }

  logger.info(
    {
      notification: bundle.notification,
      avatars: bundle.avatars,
      attachments: bundle.attachments,
    },
    'debug notif - user notifications',
  );

  return identifiers as { id: string }[];
}

export async function generateAndStoreNotificationsV2(
  entityManager: EntityManager,
  args: NotificationHandlerReturn,
): Promise<void> {
  if (!args) {
    return;
  }

  await Promise.all(
    args.map(({ type, ctx }) => {
      const bundle = generateNotificationV2(type, ctx);
      if (!bundle.userIds.length) {
        return;
      }
      return storeNotificationBundleV2(entityManager, bundle);
    }),
  );
}
