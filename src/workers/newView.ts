import { DataSource, DeepPartial } from 'typeorm';
import { Alerts, User, UserStreak, View } from '../entity';
import { messageToJson, Worker } from './worker';
import { TypeOrmError } from '../errors';
import { isFibonacci } from '../common/fibonacci';

const ONE_WEEK = 604800000;

const addView = async (
  con: DataSource,
  entity: View,
): Promise<{ view: View; isNewView: boolean }> => {
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
    const viewRecord = await repo.save(entity);
    return { view: viewRecord, isNewView: true };
  }
  return { view: existing, isNewView: false };
};

const incrementReadingStreak = async (
  con: DataSource,
  latestView: View,
): Promise<boolean> => {
  const users = con.getRepository(User);
  const repo = con.getRepository(UserStreak);
  const { userId, timestamp } = latestView;

  if (!userId) {
    return false;
  }

  // TODO: This code is temporary here for now because we didn't run the migration yet,
  // so not every user is going to have a row in the user_streak table and we need to create it.
  // We can get rid of it once/if we implement the migration in https://dailydotdev.atlassian.net/browse/MI-70
  const user = await users.findOne({
    where: { id: userId },
    relations: ['streak'],
  });
  const streak = await user?.streak;
  if (user && !streak) {
    await repo.save(
      repo.create({
        userId,
        currentStreak: 1,
        totalStreak: 1,
        maxStreak: 1,
        lastViewAt: timestamp,
      }),
    );

    return true;
  }

  if (
    streak &&
    (!streak.lastViewAt ||
      streak.currentStreak === 0 ||
      streak.lastViewAt.getDate() !== timestamp.getDate())
  ) {
    await repo.update(
      { userId },
      {
        lastViewAt: timestamp,
        currentStreak: streak.currentStreak + 1,
        totalStreak: streak.totalStreak + 1,
        maxStreak: Math.max(streak.maxStreak, streak.currentStreak + 1),
      },
    );

    // milestones are currently defined on fibonacci sequence
    const showStreakMilestone = isFibonacci(streak.currentStreak + 1);
    await con.getRepository(Alerts).save({
      userId,
      showStreakMilestone,
    });

    return true;
  }
  return false;
};

const worker: Worker = {
  subscription: 'add-views-v2',
  handler: async (message, con, logger): Promise<void> => {
    const data: DeepPartial<View> = messageToJson(message);
    let didSave = false;
    let latestView = null;
    try {
      const { isNewView, view } = await addView(
        con,
        con.getRepository(View).create({
          postId: data.postId,
          userId: data.userId,
          referer: data.referer,
          timestamp: data.timestamp && new Date(data.timestamp as string),
        }),
      );

      didSave = isNewView;
      latestView = view;

      if (!didSave) {
        logger.debug(
          {
            view: data,
            messageId: message.messageId,
          },
          'ignored view event',
        );
      }
    } catch (err) {
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

    // no need to touch reading streaks if we didn't save a new view or if we don't have a userId
    if (!didSave || !data.userId || !latestView) {
      return;
    }

    try {
      const didUpdate = await incrementReadingStreak(con, latestView);

      if (!didUpdate) {
        logger.warn(
          {
            view: data,
            messageId: message.messageId,
          },
          'missing userId in view event, cannot update reading streak',
        );
      }
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
  },
};

export default worker;
