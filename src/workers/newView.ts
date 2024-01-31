import { DataSource, DeepPartial } from 'typeorm';
import { UserStreak, View } from '../entity';
import { messageToJson, Worker } from './worker';
import { TypeOrmError } from '../errors';

const ONE_WEEK = 604800000;

const addView = async (con: DataSource, entity: View): Promise<boolean> => {
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

const DEFAULT_TIMEZONE = 'UTC'; // in case user doesn't have a timezone set
const INC_STREAK_QUERY = `
WITH u AS (
  SELECT "id",
      /* Increment the current streak if
        a) lastViewAt is NULL - this is a new user, we should start a new streak
        b) the currentStreak is 0 - we should start a new streak
        c) we didn't do it today already
      */
      ("lastViewAt" is NULL OR
       "currentStreak" = 0 OR
       DATE("lastViewAt" AT TIME ZONE COALESCE("timezone", $3)) <> DATE($2 AT TIME ZONE COALESCE("timezone", $3))
      ) AS shouldIncrementStreak
  FROM public.user AS users
  INNER JOIN user_streak ON user_streak."userId" = users.id
  WHERE users.id = $1
)
UPDATE user_streak AS us SET
  "lastViewAt" = $2,
  "updatedAt" = now(),
  "currentStreak" = CASE WHEN shouldIncrementStreak THEN us."currentStreak" + 1 ELSE us."currentStreak" END,
  "totalStreak" = CASE WHEN shouldIncrementStreak THEN us."totalStreak" + 1 ELSE us."totalStreak" END,
  "maxStreak" = CASE WHEN shouldIncrementStreak THEN GREATEST(us."maxStreak", us."currentStreak" + 1) ELSE us."maxStreak" END
FROM u
WHERE us."userId" = u.id
RETURNING shouldIncrementStreak
`;

const incrementReadingStreak = async (
  con: DataSource,
  data: DeepPartial<View>,
): Promise<boolean> => {
  const repo = con.getRepository(UserStreak);
  const { userId, timestamp } = data;

  if (!userId) {
    return false;
  }

  const viewTime = timestamp ? new Date(timestamp as string) : new Date();

  // TODO: This code is temporary here for now because we didn't run the migration yet,
  // so not every user is going to have a row in the user_streak table and we need to create it.
  // We can get rid of it once/if we implement the migration in https://dailydotdev.atlassian.net/browse/MI-70
  const existing = await repo.findOne({ where: { userId } });
  if (!existing) {
    await repo.save(
      repo.create({
        userId,
        currentStreak: 1,
        totalStreak: 1,
        maxStreak: 1,
        lastViewAt: viewTime,
      }),
    );
  } else {
    await repo.query(INC_STREAK_QUERY, [userId, viewTime, DEFAULT_TIMEZONE]);
  }
  return true;
};

const worker: Worker = {
  subscription: 'add-views-v2',
  handler: async (message, con, logger): Promise<void> => {
    const data: DeepPartial<View> = messageToJson(message);
    let didSave = false;
    try {
      didSave = await addView(
        con,
        con.getRepository(View).create({
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

    // no need to touch reading streaks if we didn't save a new view event or if we don't have a userId
    if (!didSave || !data.userId) {
      return;
    }

    try {
      const didUpdate = await incrementReadingStreak(con, data);

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
