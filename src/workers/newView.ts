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
-- Get the timezone of the user, defaulting to DEFAULT_TIMEZONE if not set
WITH u AS (
  SELECT "id", COALESCE("timezone", $3) AS timezone
  FROM public.user
  WHERE public.user.id = $1
),
-- Create a today variable in the timezone we got above
vars AS (
  SELECT (DATE($2 AT TIME ZONE u.timezone)) AS today FROM u
),
/* Store some more variables based on previous results
   * Get the date difference between the lastViewAt and today and store it in dateDiff
   * Extract current day of week from today
   * Return other columns needed below
*/
d AS (
  SELECT "userId", "currentStreak", today, (today - DATE("lastViewAt" AT TIME ZONE u.timezone)) AS dateDiff, EXTRACT(DOW FROM today) AS dayOfWeek
  FROM user_streak
  INNER JOIN u ON "userId" = u.id
  JOIN vars ON TRUE
),
cond AS (
/* shouldIncrement is set to true if
   a) currentStreak is 0
   b) dateDiff is NULL - this is to cover new users who never had a view before
   c) last view was yesterday (the date difference between today and lastViewAt is 1
   d) today is Monday and last view was Friday, Saturday or Sunday
      (the date difference is more than 1 and less than 3 - assuming 2 day weekend on Sat and Sun)
 shouldReset is set to true if
   a) today is Monday and the date difference is more than 3 (assuming 2 day weekend)
   b) today is not Monday and the date difference is more than 1
*/
  SELECT (
    "currentStreak" = 0 OR
      (dateDiff IS NULL OR
        dateDiff = 1 OR
        (dayOfWeek = 1 AND dateDiff > 1 AND dateDiff <= 3) OR
        (dayOfWeek = 0 AND dateDiff = 2)
    )) AS shouldIncrement,
    ((dayOfWeek <= 1 AND dateDiff > 2 + dayOfWeek) OR -- Monday and difference between days is more than 3 or Sunday and difference is more than 2
     (dayOfWeek > 1 AND dateDiff > 1)) AS shouldReset, -- any other day of week and difference between days is more than 1
    "userId"
  FROM d
),
/* The update query to run if shouldIncrement is true
   * Increment currentStreak by 1
   * Increment total streak by 1
   * Increment max streak if it's equal to current streak
   * set lastViewAt to the time of the event
   * set updateAt to now
*/
incrementCurrent AS (
  UPDATE user_streak AS us
  SET
    "lastViewAt" = $2,
    "updatedAt" = now(),
    "currentStreak" = us."currentStreak" + 1,
    "totalStreak" = us."totalStreak" + 1,
    "maxStreak" = CASE WHEN us."maxStreak" = us."currentStreak" THEN us."maxStreak" + 1 ELSE us."maxStreak" END
  FROM cond
  WHERE us."userId" = cond."userId" AND shouldIncrement
  RETURNING TRUE
),
/* The update query to run if shouldIncrement is false
   * set lastViewAt to the time of the event
   * set updatedAt to now
   * set currentStreak to 1 if shouldReset is true
*/
noIncrementCurrent AS (
  UPDATE user_streak AS us
  SET
    "lastViewAt" = $2,
    "updatedAt" = now(),
    "currentStreak" = CASE WHEN shouldReset THEN 1 ELSE us."currentStreak" END
  FROM cond
  WHERE us."userId" = cond."userId" AND NOT shouldIncrement
  RETURNING FALSE
)
/* Run both update queries, only one of them will actually update,
   depending on the shouldIncrement value
*/
SELECT * FROM incrementCurrent
UNION ALL
SELECT * FROM noIncrementCurrent
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
  // We can get rid of it once/if we implement the migration in MI-70.
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
    return;
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

    // no need to touch reading streaks if we didn't save a new view event
    if (!didSave) {
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
