import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { SERVING_HIDDEN_NICHE_SLUGS } from './clickhouse/worldRules';

/**
 * Districts a world needs before it is listed. A floor on being listed only:
 * such a world is still visible at its own address.
 */
export const WORLD_INDEX_MIN_DISTRICTS = 3;

/** Districts carried on a world's summary, which is what a card shows. */
export const WORLD_INDEX_TOP_NICHES = 3;

/**
 * How deep each topic's ranking goes, and the deepest placing the API states.
 * Past this a placing moves by hundreds on a single day's reading, so `rank`
 * comes back null instead.
 */
export const WORLD_RANK_DEPTH = 1000;

/** Days of the ranking's short window. */
export const WORLD_RANK_WEEK_DAYS = 7;

/**
 * How far back "recently levelled up" reaches. Wider than the daily cadence
 * that fills it, so a late cron does not empty the section.
 */
export const WORLD_LEVEL_UP_WINDOW_HOURS = 36;

/** How long a crossing is kept, bounding the table. */
export const WORLD_LEVEL_UP_RETENTION_DAYS = 7;

/** Worlds one index section will list. */
export const WORLD_INDEX_SECTION_LIMIT = 8;

/** Most rows one call may ask a topic's ranking for. */
export const WORLD_RANK_MAX_LIMIT = 50;

/**
 * Serving-hidden niches as SQL literals, for the index's materialised views.
 *
 * A view's definition is frozen when it is created, so changing
 * `SERVING_HIDDEN_NICHE_SLUGS` needs a migration that recreates them.
 */
export const hiddenNicheSqlList = SERVING_HIDDEN_NICHE_SLUGS.map(
  (slug) => `'${slug}'`,
).join(',');

/**
 * Keep private worlds out of a listing, live.
 *
 * The views exclude them too, but they refresh nightly, so on their own a world
 * would stay listed for up to a day after its owner hid it. Kept as a second,
 * independent check so a mistake in either alone cannot expose a world.
 */
export const applyWorldIndexPrivacy = <T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  ownerColumn: string,
): SelectQueryBuilder<T> =>
  queryBuilder.andWhere(
    `NOT EXISTS (SELECT 1 FROM user_world_settings s WHERE s."userId" = ${ownerColumn} AND s.private = true)`,
  );
