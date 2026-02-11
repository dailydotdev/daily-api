import { DataSource, DeepPartial, EntityManager } from 'typeorm';
import { Alerts, Post, PostType, User, UserStreak, View } from '../entity';
import { messageToJson, Worker } from './worker';
import { TypeORMQueryFailedError, TypeOrmError } from '../errors';
import { isFibonacci } from '../common/fibonacci';
import { generateStorageKey, StorageKey, StorageTopic } from '../config';
import { deleteRedisKey } from '../redis';
import { logger } from '../logger';
import {
  AchievementEventType,
  checkAchievementProgress,
} from '../common/achievement';
import { FastifyBaseLogger } from 'fastify';

const checkBriefReadAchievement = async (
  con: DataSource,
  logger: FastifyBaseLogger,
  postId: string,
  userId: string,
): Promise<void> => {
  try {
    const post = await con.getRepository(Post).findOne({
      where: { id: postId },
      select: ['id', 'type'],
    });

    if (post?.type === PostType.Brief) {
      await checkAchievementProgress(
        con,
        logger,
        userId,
        AchievementEventType.BriefRead,
      );
    }
  } catch (err) {
    logger.error(
      { postId, userId, err },
      'failed to check brief read achievement',
    );
    // Don't throw - achievement failures shouldn't block the main operation
  }
};

interface ShouldIncrement {
  currentStreak: number;
  totalStreak: number;
  maxStreak: number;
  shouldIncrement: boolean;
}

const ONE_WEEK = 604800000;
const DEFAULT_TIMEZONE = 'UTC'; // in case user doesn't have a timezone set

const addView = async (con: EntityManager, entity: View): Promise<boolean> => {
  const repo = con.getRepository(View);
  const existing = await repo.findOne({
    where: {
      userId: entity.userId,
      postId: entity.postId,
    },
    order: { timestamp: 'DESC' },
  });
  if (
    !existing ||
    entity.timestamp.getTime() - existing.timestamp.getTime() > ONE_WEEK
  ) {
    await repo.save(entity);
    return true;
  }
  return false;
};

const shouldIncrementStreak = async (
  con: EntityManager,
  userId: string,
  viewTime: Date,
): Promise<ShouldIncrement | undefined> => {
  return await con
    .createQueryBuilder()
    .select(
      `("lastViewAt" is NULL OR
       "currentStreak" = 0 OR
       DATE("lastViewAt" AT TIME ZONE COALESCE("timezone", :timezone)) <> DATE(:viewTime AT TIME ZONE COALESCE("timezone", :timezone))
      )`,
      'shouldIncrement',
    )
    .addSelect('us."currentStreak"', 'currentStreak')
    .addSelect('us."totalStreak"', 'totalStreak')
    .addSelect('us."maxStreak"', 'maxStreak')
    .from(UserStreak, 'us')
    .leftJoin(User, 'u', 'u.id = us."userId"')
    .where('us.userId = :userId', { userId })
    .setParameter('timezone', DEFAULT_TIMEZONE)
    .setParameter('viewTime', viewTime)
    .getRawOne<ShouldIncrement>();
};

const incrementReadingStreak = async (
  manager: EntityManager,
  data: DeepPartial<View>,
  messageId: string | undefined,
): Promise<boolean> => {
  const { userId, timestamp } = data;

  if (!userId) {
    logger.warn(
      {
        view: data,
        messageId: messageId,
      },
      'missing userId in view event, cannot update reading streak',
    );
    return false;
  }

  const viewTime = timestamp ? new Date(timestamp as string) : new Date();

  const shouldIncrementResult = await shouldIncrementStreak(
    manager,
    userId,
    viewTime,
  );

  if (!shouldIncrementResult) {
    return false;
  }

  const { currentStreak, totalStreak, maxStreak, shouldIncrement } =
    shouldIncrementResult ?? {};

  if (shouldIncrement) {
    const newCurrentStreak = currentStreak + 1;

    if (newCurrentStreak > 1) {
      const key = generateStorageKey(
        StorageTopic.Streak,
        StorageKey.Reset,
        userId,
      );

      await Promise.all([
        manager
          .getRepository(Alerts)
          .update({ userId }, { showRecoverStreak: false }),
        deleteRedisKey(key),
      ]);
    }

    await manager.getRepository(UserStreak).update(
      { userId },
      {
        lastViewAt: viewTime,
        updatedAt: new Date(),
        currentStreak: newCurrentStreak,
        totalStreak: totalStreak + 1,
        maxStreak: Math.max(newCurrentStreak, maxStreak),
      },
    );

    // milestones are currently defined on fibonacci sequence
    const showStreakMilestone =
      isFibonacci(newCurrentStreak) && newCurrentStreak > 1;
    await manager.getRepository(Alerts).save({
      userId,
      showStreakMilestone,
    });
  }

  return true;
};

const worker: Worker = {
  subscription: 'add-views-v2',
  handler: async (message, con, logger): Promise<void> => {
    const data: DeepPartial<View> = messageToJson(message);
    let didSave = false;
    await con.transaction(async (manager: EntityManager) => {
      try {
        didSave = await addView(
          manager,
          manager.getRepository(View).create({
            postId: data.postId,
            userId: data.userId,
            referer: data.referer,
            timestamp: data.timestamp && new Date(data.timestamp as string),
          }),
        );
        if (!didSave) {
          logger.debug(
            {
              view: data,
              messageId: message.messageId,
            },
            'ignored view event',
          );
        }
      } catch (originalError) {
        const err = originalError as TypeORMQueryFailedError;

        // Foreign / unique
        if (
          err?.code === TypeOrmError.NULL_VIOLATION ||
          err?.code === TypeOrmError.FOREIGN_KEY
        ) {
          return;
        }

        logger.error(
          {
            view: data,
            messageId: message.messageId,
            err,
          },
          'failed to add view event to db',
        );
        if (err.name === 'QueryFailedError') {
          return;
        }
        throw err;
      }

      // no need to touch reading streaks if we didn't save a new view event or if we don't have a userId
      if (!didSave || !data.userId) {
        return;
      }

      try {
        await incrementReadingStreak(manager, data, message.messageId);
      } catch (err) {
        logger.error(
          {
            view: data,
            messageId: message.messageId,
            err,
          },
          'failed to increment reading streak data',
        );
        throw err;
      }
    });

    // Check BriefRead achievement outside the transaction
    if (didSave && data.userId && data.postId) {
      await checkBriefReadAchievement(con, logger, data.postId, data.userId);
    }
  },
};

export default worker;
