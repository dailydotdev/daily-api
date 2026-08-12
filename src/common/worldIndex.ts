import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/**
 * Rules the world index is built and served by.
 *
 * The index is the first place a world is shown to somebody who does not own
 * it, so everything here is either a privacy rule or a floor below which a
 * listing says nothing.
 */

/**
 * Districts a world needs before it is worth listing.
 *
 * A world with one or two districts is a reader who has opened a handful of
 * articles, and putting it on a page next to worlds built over years reads as
 * an empty plot rather than a small one. It is a floor on being LISTED only:
 * such a world is still perfectly visible at its own address.
 */
export const WORLD_INDEX_MIN_DISTRICTS = 3;

/**
 * Districts carried on a world's summary, which is what a card shows.
 *
 * Three, because a card is about what a world is mostly made of and the fourth
 * topic has never changed that answer.
 */
export const WORLD_INDEX_TOP_NICHES = 3;

/**
 * How deep each topic's ranking is materialised, and therefore the deepest
 * placing the API will state.
 *
 * Past this a placing is not a standing, it is a record of who else happened
 * to open the topic, and it moves by hundreds on a single day's reading. So the
 * ranking stops here and `rank` comes back null beyond it, the same shape
 * `leaderboardPosition` uses beyond its own cap. Keeping the materialisation to
 * a fixed depth per topic is also what lets it be rebuilt whole every night
 * rather than maintained incrementally.
 */
export const WORLD_RANK_DEPTH = 1000;

/** Days of the ranking's short window. */
export const WORLD_RANK_WEEK_DAYS = 7;

/**
 * How far back "recently levelled up" reaches.
 *
 * The crossings are written by a daily cron, so a strict 24 hours would empty
 * the section whenever that cron ran late and would half-empty it for the hours
 * either side. Wider than the cadence that fills it, on purpose.
 */
export const WORLD_LEVEL_UP_WINDOW_HOURS = 36;

/**
 * How long a crossing is kept.
 *
 * Only the last day is ever served; the rest of the week is slack for a cron
 * that did not run, and a bound so the table cannot grow without limit.
 */
export const WORLD_LEVEL_UP_RETENTION_DAYS = 7;

/** Worlds one index section will list. */
export const WORLD_INDEX_SECTION_LIMIT = 8;

/** Most rows one call may ask a topic's ranking for. */
export const WORLD_RANK_MAX_LIMIT = 50;

/**
 * Keep private worlds out of a listing, live.
 *
 * `user_world_summary` already excludes them, but it is rebuilt nightly, so on
 * its own it would leave a world listed for up to a day after its owner made it
 * private. This runs on every read and closes that window.
 *
 * Deliberately kept as a second check rather than replacing the one in the
 * cron: they fail independently, so a mistake in either alone cannot expose a
 * world. `applyWorldPrivacy` in `userWorld.ts` is the same rule for a single
 * known owner; this is the set version, correlated against whatever column the
 * listing holds the owner in.
 */
export const applyWorldIndexPrivacy = <T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  ownerColumn: string,
): SelectQueryBuilder<T> =>
  queryBuilder.andWhere(
    `NOT EXISTS (SELECT 1 FROM user_world_settings s WHERE s."userId" = ${ownerColumn} AND s.private = true)`,
  );
