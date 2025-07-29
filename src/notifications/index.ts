import {
  NotificationAttachmentV2,
  NotificationAvatarV2,
  NotificationV2,
  UserNotification,
} from '../entity';
import { DeepPartial, EntityManager, In, ObjectLiteral } from 'typeorm';
import { NotificationBuilder } from './builder';
import { NotificationBaseContext, NotificationBundleV2 } from './types';
import { generateNotificationMap, notificationTitleMap } from './generate';
import { generateUserNotificationUniqueKey, NotificationType } from './common';
import { NotificationHandlerReturn } from '../workers/notifications/worker';
import { EntityTarget } from 'typeorm/common/EntityTarget';
import { ContentPreference } from '../entity/contentPreference/ContentPreference';
import {
  ContentPreferenceStatus,
  ContentPreferenceType,
} from '../entity/contentPreference/types';
import { User } from '../entity/user/User';
import { shouldSendNotification } from '../workers/notifications/utils';

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

  if (!generatedMaps?.[0]?.id) {
    return [];
  }

  const notification = generatedMaps[0] as NotificationV2;
  const uniqueKey = generateUserNotificationUniqueKey(notification);

  const userPreferences = new Map<string, User>();
  const userChunks: string[][] = [];
  const chunkSize = 500;

  for (let i = 0; i < bundle.userIds.length; i += chunkSize) {
    userChunks.push(bundle.userIds.slice(i, i + chunkSize));
  }

  for (const chunk of userChunks) {
    const users = await entityManager.getRepository(User).find({
      select: ['id', 'notificationFlags'],
      where: { id: In(chunk) },
    });

    users.forEach((user) => {
      userPreferences.set(user.id, user);
    });
  }

  const chunks: Pick<
    UserNotification,
    'userId' | 'notificationId' | 'createdAt' | 'public' | 'uniqueKey'
  >[][] = [];

  bundle.userIds.forEach((userId) => {
    if (chunks.length === 0 || chunks[chunks.length - 1].length === chunkSize) {
      chunks.push([]);
    }

    const user = userPreferences.get(userId);
    const shouldShowInApp = shouldSendNotification(
      user?.notificationFlags,
      notification.type as NotificationType,
      'inApp',
    );

    chunks[chunks.length - 1].push({
      userId,
      notificationId: notification.id,
      createdAt: notification.createdAt,
      public: notification.public && shouldShowInApp,
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

  return identifiers as { id: string }[];
}

export async function generateAndStoreNotificationsV2(
  entityManager: EntityManager,
  args: NotificationHandlerReturn,
): Promise<void> {
  if (!args) {
    return;
  }
  const filteredArgs = [];

  for (const arg of args) {
    const { type, ctx } = arg;
    if (!ctx.initiatorId) {
      filteredArgs.push(arg);
      continue;
    }

    const userIdChunks: string[][] = [];
    for (let i = 0; i < ctx.userIds.length; i += 500) {
      userIdChunks.push(ctx.userIds.slice(i, i + 500));
    }

    const contentPreferences: ContentPreference[] = [];

    for (const chunk of userIdChunks) {
      const preferences = await entityManager
        .getRepository<
          ContentPreference<ContentPreferenceStatus>
        >(ContentPreference)
        .find({
          where: {
            feedId: In(chunk),
            referenceId: ctx.initiatorId!,
            status: ContentPreferenceStatus.Blocked,
            type: ContentPreferenceType.User,
          },
        });
      contentPreferences.push(...preferences);
    }

    const receivingUserIds = ctx.userIds.filter(
      (id) => !contentPreferences.some((pref) => pref.userId === id),
    );

    if (receivingUserIds.length === 0) {
      continue;
    }

    filteredArgs.push({
      type,
      ctx: {
        ...ctx,
        userIds: receivingUserIds,
      },
    });
  }

  await Promise.all(
    filteredArgs.map(({ type, ctx }) => {
      const bundle = generateNotificationV2(type, ctx);
      if (!bundle.userIds.length) {
        return;
      }
      return storeNotificationBundleV2(entityManager, bundle);
    }),
  );
}
