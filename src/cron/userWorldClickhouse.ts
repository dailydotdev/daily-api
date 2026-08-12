import { format } from 'date-fns';
import type { DataSource } from 'typeorm';
import { z } from 'zod';
import { Cron } from './cron';
import { getClickHouseClient } from '../common/clickhouse';
import { userWorldDeltaQuery } from '../common/clickhouse/worldRules';
import {
  userWorldDeltaSchema,
  type UserWorldDelta,
} from '../common/schema/userWorld';
import { UserNicheAnalytics } from '../entity/user/UserNicheAnalytics';
import { UserNicheGrowth } from '../entity/user/UserNicheGrowth';
import { getRedisHash, setRedisHash } from '../redis';
import { generateStorageKey, StorageTopic } from '../config';
import {
  districtLevelOf,
  WORLD_LEVEL_UP_MIN_LEVEL,
} from '../common/worldLadder';
import { triggerTypedEvent } from '../common/typedPubsub';

type UserWorldCronConfig = Partial<{
  cursor: string;
}>;

/** A district that crossed a rung in this run. */
type WorldLevelCrossing = {
  userId: string;
  nicheId: string;
  level: number;
  reads: number;
};

/** What RETURNING actually hands back — `date` may be a string or a Date. */
type RawGrowthRow = Omit<UserWorldDelta, 'date'> & { date: string | Date };

const GROWTH_CHUNK_SIZE = 1000;
const DISTRICT_CHUNK_SIZE = 500;
const LEVEL_UP_CHUNK_SIZE = 100;

/**
 * Normalise a date column to 'YYYY-MM-DD'.
 *
 * Postgres `date` values reach us as either a string or a Date depending on the
 * driver path — a `::text` cast in the query is NOT sufficient, because TypeORM
 * re-hydrates the value when the select alias matches an entity column. These are
 * calendar days, so they are compared and stored as plain ISO strings.
 */
const toDay = (value: string | Date): string =>
  typeof value === 'string' ? value.slice(0, 10) : format(value, 'yyyy-MM-dd');

/**
 * Where to resume when Redis has no cursor.
 *
 * Redis is a cache: keys get evicted, flushed, or simply do not exist in a new
 * environment. The cursor cannot be the only record of how far we have ingested,
 * because a constant fallback is catastrophic in both directions — an early one
 * (2022) replays four years through the delta path, and a late one (now) silently
 * skips whatever was missed. Neither fails loudly.
 *
 * The growth log already knows. It stores whole days, and a run only ever covers
 * whole days, so the day after its newest row is exactly where the last successful
 * run stopped. Redis becomes an optimisation rather than the source of truth.
 *
 * Deriving a day or two early is harmless: growth rows are keyed
 * (userId, date, nicheId) and inserted ON CONFLICT DO NOTHING, so re-covering a
 * window inserts nothing and leaves districts untouched.
 *
 * An empty table means the bulk seed has not run. That is refused rather than
 * guessed — from here the delta path would take days to catch up and would produce
 * wrong districts while it did.
 *
 * The scan is unindexed, but this only runs when the cursor is missing.
 */
const cursorFromGrowthLog = async (con: DataSource): Promise<Date> => {
  const latest = await con
    .getRepository(UserNicheGrowth)
    .createQueryBuilder('growth')
    .select('MAX(growth.date)::text', 'date')
    .getRawOne<{ date: string | null }>();

  if (!latest?.date) {
    throw new Error(
      `${userWorldClickhouseCron.name}: no cursor in Redis and user_niche_growth is empty. ` +
        'Seed both tables from the bulk export and set the cursor to the export upper bound ' +
        'before enabling this cron.',
    );
  }

  const [year, month, day] = toDay(latest.date).split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day + 1));
};

const chunk = <T>(items: T[], size: number): T[][] =>
  items.reduce<T[][]>((acc, item) => {
    if (acc.length === 0 || acc[acc.length - 1].length === size) {
      acc.push([]);
    }
    acc[acc.length - 1].push(item);

    return acc;
  }, []);

/**
 * The rung a district just crossed, or null if it did not cross one worth
 * saying out loud.
 *
 * Free to compute where it is called: both sides of the comparison are already
 * in hand for every district the run touched, so this adds no query, no scan
 * and no second pass over the delta.
 */
const crossingOf = (
  next: Pick<WorldLevelCrossing, 'userId' | 'nicheId' | 'reads'>,
  priorReads: number,
): WorldLevelCrossing | null => {
  const level = districtLevelOf(next.reads);

  if (
    level < WORLD_LEVEL_UP_MIN_LEVEL ||
    level <= districtLevelOf(priorReads)
  ) {
    return null;
  }

  return {
    userId: next.userId,
    nicheId: next.nicheId,
    level,
    reads: next.reads,
  };
};

/**
 * One level-up per user per run, highest rung first.
 *
 * The cron covers whole days in a single pass, so a reader can cross rungs in
 * several districts at once, and a run that has been down for a week crosses a
 * great many. Sending each turns an earned trigger into a burst of push
 * notifications that all land in the same second, which is the fastest way to
 * get the channel muted for good.
 *
 * Ties break towards more reads: of two districts arriving on the same rung,
 * the bigger one is the one they are actually reading.
 */
const bestCrossingPerUser = (
  crossings: WorldLevelCrossing[],
): WorldLevelCrossing[] => {
  const best = new Map<string, WorldLevelCrossing>();

  for (const crossing of crossings) {
    const current = best.get(crossing.userId);

    if (
      !current ||
      crossing.level > current.level ||
      (crossing.level === current.level && crossing.reads > current.reads)
    ) {
      best.set(crossing.userId, crossing);
    }
  }

  return [...best.values()];
};

export const userWorldClickhouseCron: Cron = {
  name: 'user-world-clickhouse',
  handler: async (con, logger) => {
    const redisStorageKey = generateStorageKey(
      StorageTopic.Cron,
      userWorldClickhouseCron.name,
      'config',
    );

    const cronConfig: UserWorldCronConfig = await getRedisHash(redisStorageKey);
    const cursor = cronConfig.cursor
      ? new Date(cronConfig.cursor)
      : await cursorFromGrowthLog(con);

    if (Number.isNaN(cursor.getTime())) {
      throw new Error('Invalid cursor');
    }

    // Bounded to the last UTC midnight, never to now().
    //
    // The growth row is keyed (userId, date, nicheId) and inserted ON CONFLICT DO
    // NOTHING, so a given day may only ever be written ONCE. Running to now() would
    // split today: this run would write the 00:00-03:00 slice under today's date,
    // and tomorrow's run would re-submit the rest of today, hit the conflict and
    // silently drop it. Whole days only.
    //
    // It also removes the clock-skew edge for free — events dated in the future are
    // beyond `until` and simply wait for the run that covers them.
    const now = new Date();
    const until = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    // A second run on the same day has nothing new to cover.
    if (cursor >= until) {
      logger.info(
        { cursor: cursor.toISOString(), until: until.toISOString() },
        'user world already synced up to the last full day',
      );

      return;
    }

    const clickhouseClient = getClickHouseClient();
    const queryParams = {
      cursor: format(cursor, 'yyyy-MM-dd HH:mm:ss'),
      until: format(until, 'yyyy-MM-dd HH:mm:ss'),
    };

    const response = await clickhouseClient.query({
      query: userWorldDeltaQuery,
      format: 'JSONEachRow',
      query_params: queryParams,
    });

    const result = z
      .array(userWorldDeltaSchema)
      .safeParse(await response.json());

    if (!result.success) {
      logger.error(
        { schemaError: result.error.issues[0] },
        'Invalid user world delta data',
      );

      throw new Error('Invalid user world delta data');
    }

    const { data } = result;

    if (data.length === 0) {
      await setRedisHash<UserWorldCronConfig>(redisStorageKey, {
        cursor: until.toISOString(),
      });
      logger.info({ queryParams }, 'no user world changes');

      return;
    }

    // Growth insert and district advance share one transaction. That is what makes
    // the accumulator below exact: a half-applied run rolls back both, and the retry
    // finds the growth rows already present, so `RETURNING` yields nothing and the
    // districts are left alone. Advancing districts from the raw delta instead of
    // from what was actually inserted is what would double-count.
    let inserted: UserWorldDelta[] = [];
    let skipped = 0;
    let missingNiches = 0;
    // Collected inside the transaction, published after it commits. Publishing
    // from in there would announce a rung to a reader whose district the
    // rollback then puts back where it was, and pubsub has no undo.
    const crossings: WorldLevelCrossing[] = [];

    await con.transaction(async (manager) => {
      // 0. Keep only rows whose user AND niche Postgres still has.
      //
      //    The delta comes from ClickHouse mirrors of `api.user` and `api.niche`.
      //    The query already drops deletion tombstones, but the mirrors lag: a row
      //    removed since the last replicated batch is still live there and already
      //    gone here. Both columns are foreign keys, so one such row does not skip
      //    a district — it aborts the run. That is exactly how the first production
      //    run failed on the user side, and with `restartPolicy: OnFailure` it then
      //    retried the same doomed insert until the deadline killed it.
      //
      //    The two differ only in how often the window is open, not in what happens
      //    when it is. Users delete themselves continuously, which is why that side
      //    broke on day one; niches are a small catalogue changed by hand, so the
      //    same failure is rare rather than impossible. Rare and total is still
      //    worth two cheap lookups.
      //
      //    FOR KEY SHARE is the lock the FK check takes anyway, taken earlier. That
      //    is what makes this a guarantee rather than a narrower window: it blocks
      //    deletion of these rows for the rest of the transaction, so neither a user
      //    nor a niche can disappear between these SELECTs and the INSERT below. It
      //    does not block ordinary updates, which take a weaker lock.
      const presentUsers: { id: string }[] = await manager.query(
        'SELECT id FROM "user" WHERE id = ANY($1) FOR KEY SHARE',
        [[...new Set(data.map((row) => row.userId))]],
      );
      const presentNiches: { id: string }[] = await manager.query(
        'SELECT id FROM "niche" WHERE id = ANY($1) FOR KEY SHARE',
        [[...new Set(data.map((row) => row.nicheId))]],
      );

      const knownUsers = new Set(presentUsers.map((row) => row.id));
      const knownNiches = new Set(presentNiches.map((row) => row.id));
      const insertable = data.filter(
        (row) => knownUsers.has(row.userId) && knownNiches.has(row.nicheId),
      );

      skipped = data.length - insertable.length;
      missingNiches =
        new Set(data.map((row) => row.nicheId)).size - knownNiches.size;

      // 1. Append to the growth log. The composite key makes replaying a window a
      //    no-op, which is what lets the cron be rerun after a partial failure.
      for (const rows of chunk(insertable, GROWTH_CHUNK_SIZE)) {
        const result = await manager
          .createQueryBuilder()
          .insert()
          .into(UserNicheGrowth)
          .values(rows)
          .orIgnore()
          .returning(['userId', 'date', 'nicheId', 'reads'])
          .execute();

        // `date` comes back from RETURNING on a date column, so it carries the
        // same string-or-Date ambiguity as the read below. Normalise once, here,
        // and everything downstream is plain 'YYYY-MM-DD'.
        inserted = inserted.concat(
          (result.raw as RawGrowthRow[]).map((row) => ({
            ...row,
            date: toDay(row.date),
          })),
        );
      }

      if (inserted.length === 0) {
        return;
      }

      // 2. Fold the *new* rows only, into one pending change per district.
      const pending = new Map<
        string,
        {
          userId: string;
          nicheId: string;
          reads: number;
          firstReadAt: string;
          lastReadAt: string;
          activeDays: number;
        }
      >();

      for (const row of inserted) {
        const key = `${row.userId}:${row.nicheId}`;
        const current = pending.get(key);

        if (!current) {
          pending.set(key, {
            userId: row.userId,
            nicheId: row.nicheId,
            reads: row.reads,
            firstReadAt: row.date,
            lastReadAt: row.date,
            // one growth row per (user, date, niche) by primary key, so each
            // inserted row is exactly one newly-active day
            activeDays: 1,
          });
          continue;
        }

        current.reads += row.reads;
        current.activeDays += 1;
        current.firstReadAt =
          row.date < current.firstReadAt ? row.date : current.firstReadAt;
        current.lastReadAt =
          row.date > current.lastReadAt ? row.date : current.lastReadAt;
      }

      // 3. Add the pending change onto whatever the district already holds.
      //    Only the touched districts are read — cost tracks the delta, not the
      //    user's accumulated history.
      const changes = [...pending.values()];

      for (const batch of chunk(changes, DISTRICT_CHUNK_SIZE)) {
        const existing = await manager
          .getRepository(UserNicheAnalytics)
          .createQueryBuilder('district')
          .select('district."userId"', 'userId')
          .addSelect('district."nicheId"', 'nicheId')
          .addSelect('district.reads', 'reads')
          // The ::text cast is not load-bearing — TypeORM re-hydrates the value
          // to a Date anyway when the alias matches an entity column. `toDay`
          // below is what actually guarantees a 'YYYY-MM-DD' string.
          .addSelect('district."firstReadAt"::text', 'firstReadAt')
          .addSelect('district."lastReadAt"::text', 'lastReadAt')
          .addSelect('district."activeDays"', 'activeDays')
          .where('district."userId" IN (:...userIds)', {
            userIds: [...new Set(batch.map((change) => change.userId))],
          })
          .getRawMany<{
            userId: string;
            nicheId: string;
            reads: number;
            // Typed loosely on purpose: the `::text` cast above does NOT guarantee a
            // string here, because the alias matches an entity column and TypeORM
            // re-hydrates it as a Date. `toDay` below is what actually pins it.
            firstReadAt: string | Date;
            lastReadAt: string | Date;
            activeDays: number;
          }>();

        const before = new Map(
          existing.map((row) => [`${row.userId}:${row.nicheId}`, row]),
        );

        const values = batch.map((change) => {
          const prior = before.get(`${change.userId}:${change.nicheId}`);

          if (!prior) {
            const crossing = crossingOf(change, 0);

            if (crossing) {
              crossings.push(crossing);
            }

            return change;
          }

          // Both sides must be 'YYYY-MM-DD' strings before comparing. Left as a
          // Date, `date < 'YYYY-MM-DD'` coerces the Date through toString() to
          // "Wed Jul 01 2026 …", and 'W' sorts above any digit — so the comparison
          // silently inverts and the earlier date loses. That put a district's
          // founding date at its most recent read instead of its first.
          const priorFirst = toDay(prior.firstReadAt);
          const priorLast = toDay(prior.lastReadAt);

          const merged = {
            userId: change.userId,
            nicheId: change.nicheId,
            reads: prior.reads + change.reads,
            activeDays: prior.activeDays + change.activeDays,
            firstReadAt:
              priorFirst < change.firstReadAt ? priorFirst : change.firstReadAt,
            lastReadAt:
              priorLast > change.lastReadAt ? priorLast : change.lastReadAt,
          };

          const crossing = crossingOf(merged, prior.reads);

          if (crossing) {
            crossings.push(crossing);
          }

          return merged;
        });

        // Plain overwrite is safe because the totals above are already summed.
        await manager
          .createQueryBuilder()
          .insert()
          .into(UserNicheAnalytics)
          .values(values)
          .orUpdate(
            ['reads', 'firstReadAt', 'lastReadAt', 'activeDays'],
            ['userId', 'nicheId'],
          )
          .execute();
      }
    });

    await setRedisHash<UserWorldCronConfig>(redisStorageKey, {
      cursor: until.toISOString(),
    });

    const levelUps = bestCrossingPerUser(crossings);

    // Chunked rather than one Promise.all over everything: a busy day is
    // thousands of readers, and the point of a daily cron is that it has time.
    for (const batch of chunk(levelUps, LEVEL_UP_CHUNK_SIZE)) {
      await Promise.all(
        batch.map((crossing) =>
          triggerTypedEvent(logger, 'api.v1.world-district-level-up', crossing),
        ),
      );
    }

    logger.info(
      {
        rows: data.length,
        inserted: inserted.length,
        // Districts that crossed a rung, against readers actually told about
        // it. A wide gap is the fold doing its job; a gap that closes means
        // readers are crossing one rung at a time, which is the healthy shape.
        crossings: crossings.length,
        levelUps: levelUps.length,
        // Rows dropped because the mirror still lists a user or niche Postgres no
        // longer has. A handful is normal replication lag; a sudden jump means a
        // mirror has fallen behind and worlds are being built from stale membership.
        skipped,
        // Broken out because the two mean different things. Missing users are
        // routine — people delete accounts all day. A missing niche is not: the
        // catalogue is curated, so anything above zero means the niche mirror is
        // stale and reads are being filed under a niche that no longer exists.
        missingNiches,
        users: new Set(data.map((row) => row.userId)).size,
        queryParams,
      },
      'synced user world data',
    );
  },
};
