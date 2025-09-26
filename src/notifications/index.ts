import {
  NotificationAttachmentV2,
  NotificationAvatarV2,
  NotificationV2,
} from '../entity';
import { DeepPartial, EntityManager, In, ObjectLiteral } from 'typeorm';
import { NotificationBuilder } from './builder';
import { NotificationBaseContext, NotificationBundleV2 } from './types';
import { generateNotificationMap, notificationTitleMap } from './generate';
import {
  generateUserNotificationUniqueKey,
  NotificationChannel,
  NotificationType,
} from './common';
import { NotificationHandlerReturn } from '../workers/notifications/worker';
import { EntityTarget } from 'typeorm/common/EntityTarget';
import { ContentPreference } from '../entity/contentPreference/ContentPreference';
import {
  ContentPreferenceStatus,
  ContentPreferenceType,
} from '../entity/contentPreference/types';
import { User } from '../entity/user/User';

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
  dedupKey?: string,
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
  const uniqueKey = generateUserNotificationUniqueKey({
    ...notification,
    dedupKey,
  });

  const chunkSize = 500;

  const userIdChunks: string[][] = [];
  for (let i = 0; i < bundle.userIds.length; i += chunkSize) {
    userIdChunks.push(bundle.userIds.slice(i, i + chunkSize));
  }

  for (const userChunk of userIdChunks) {
    const selectQuery = entityManager
      .createQueryBuilder()
      .select('u.id', 'userId')
      .addSelect(':notificationId', 'notificationId')
      .addSelect(':createdAt', 'createdAt')
      .addSelect(':uniqueKey', 'uniqueKey')
      .from(User, 'u')
      .where('u.id IN (:...userIds)', { userIds: userChunk })
      .setParameters({
        notificationId: notification.id,
        createdAt: notification.createdAt,
        public: notification.public,
        uniqueKey,
        notificationType: notification.type,
        // here we filter in app notification, all other filtering is done in streamNotificationUsers on
        // appropriate channel
        channel: NotificationChannel.InApp,
      });

    // if notification is public check user inApp preference and mute it if needed
    // else just keep notification original public state
    if (notification.public) {
      selectQuery.addSelect(
        `COALESCE(u."notificationFlags" -> :notificationType ->> :channel, 'subscribed') != 'muted'`,
        'public',
      );
    } else {
      selectQuery.addSelect(':public', 'public');
    }

    const [query, params] = selectQuery.getQueryAndParameters();

    await entityManager.query(
      `INSERT INTO "user_notification" ("userId", "notificationId", "createdAt", "uniqueKey", "public")
       ${query}
       ON CONFLICT ("userId", "uniqueKey") WHERE "uniqueKey" IS NOT NULL DO NOTHING`,
      params,
    );
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
      return storeNotificationBundleV2(entityManager, bundle, ctx.dedupKey);
    }),
  );
}
