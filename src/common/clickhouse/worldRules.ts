/**
 * The single definition of what counts as a "read" for personal worlds.
 *
 * These CTEs decide which events become reads, which post each read is attributed
 * to, and which niche it lands in. Every consumer must use this one copy: if the
 * delta cron and a backfill ever disagree on share collapsing, exclusions or niche
 * selection, the numbers they produce stop being comparable and the drift is silent.
 *
 * Reasoning for each rule is in devcraft `docs/DATA.md`; the short version:
 *
 * - `article page view` + `article modal view` + `go to link` all count. Dropping
 *   `go to link` loses genuine reads of external articles (8,564 pairs on a sample
 *   day fired it and nothing else).
 * - Shares collapse into `sharedPostId`. Share rows carry a NULL title and the
 *   article lives on the parent; filtering them instead discarded 12% of traffic.
 * - `daily_updates` / `dailydevworld` are first-party daily.dev squads — product
 *   notification, not content. Excluded by source id.
 * - `private = 1` is inherited from the source, and the `unknown` placeholder source
 *   is itself flagged private. Excluding it outright drops ~23% of reads to catch
 *   ~31. So: private AND not `unknown`.
 * - Self-reads are excluded — author, scout, and reading your own share. Only 1.58%
 *   platform-wide but 27.6% for an active poster.
 * - `blockchain` is not part of the world.
 *
 * `event_timestamp` is the clock. It is the table's sort-key prefix, so a cursor
 * range on it prunes granules; `server_timestamp` is more accurate but unindexed and
 * scanning 3.8B rows per run is not viable. The cost is that ~1.4% of events are
 * client-clock-skewed by over a minute, which can move a read to an adjacent day but
 * never changes whether it counts.
 *
 * `api.post_niche` never collapses stale rows — `_version` sits inside its sorting
 * key, so updates and delete tombstones never apply, even under FINAL, and a post
 * keeps the `other` row it was created with. `livePostNiche` therefore resolves each
 * (postId, nicheId) pair by its own latest version rather than trusting FINAL.
 */

/**
 * The `<origin> view` events that actually fire, plus the click-through.
 *
 * View events are generated in the webapp as `${origin} view` from the `PostOrigin`
 * union (apps `packages/shared/src/hooks/log/useLogContextData.ts`). That union also
 * declares `reader modal` and `brief modal`, but neither has fired once in 90 days,
 * so they are left out until they do.
 *
 * That means **this list has to be revisited when a new post surface ships** — it is
 * a snapshot of which origins are live, not the union itself. Cross-check against
 * `PostOrigin` rather than against ClickHouse volume, or a new surface looks
 * identical to a surface nobody uses.
 *
 * `collection modal view` was missed originally: 33,140 events in 90 days, and 97.7%
 * of its (user, post) pairs are not reached by any other read event, so it is
 * additive rather than a duplicate of the article events.
 */
export const READ_EVENTS = [
  'article page view',
  'article modal view',
  'collection modal view',
  'go to link',
] as const;

/**
 * First-party daily.dev surfaces: product notification, not content.
 *
 * Source ids, given directly, so `api.source` drops out of the query entirely — it
 * was only ever joined to translate handles into these. Ids are also the least
 * ambiguous key of the three: `dailydevworld` is a *handle* whose id is a UUID, and
 * a separate third-party squad is *named* "Dev World", so both of the other columns
 * can mislead.
 */
export const EXCLUDED_SOURCE_IDS = [
  'daily_updates', // daily.dev Changelog
  'a1f0092b-0ee1-414b-82e6-f2c92d7335e4', // daily.dev World
] as const;

/** Niches that never appear in a world. */
export const EXCLUDED_NICHE_SLUGS = ['blockchain'] as const;

const asSqlList = (values: readonly string[]): string =>
  values.map((value) => `'${value}'`).join(',');

/**
 * Shared CTE block. Consumers append their own SELECT.
 *
 * Exposes: `eff` (post id with shares collapsed), `pmeta` (author/scout of the
 * resolved post), `pn` (one niche per post), `nc` (niche slugs), `du` (excluded
 * posts), `pv` (private posts), `reg` (registered users). `api.source` is not
 * touched — the first-party exclusion uses ids directly.
 */
export const worldRulesCte = /* sql */ `
res AS (
  SELECT id,
         argMax(type, _version) AS ty,
         argMax(sharedPostId, _version) AS sp,
         ifNull(argMax(authorId, _version), '') AS au
  FROM api.post GROUP BY id),
eff AS (
  SELECT id,
         if(ty = 'share' AND sp IS NOT NULL AND sp != '', sp, id) AS eff_id,
         au AS share_author
  FROM res),
pmeta AS (
  SELECT id,
         ifNull(argMax(authorId, _version), '') AS au,
         ifNull(argMax(scoutId, _version), '') AS sc
  FROM api.post GROUP BY id),
livePostNiche AS (
  SELECT postId, nicheId,
         argMax(rank, _version) AS rank,
         argMax(score, _version) AS score,
         argMax(is_deleted, _version) AS del
  FROM api.post_niche GROUP BY postId, nicheId HAVING del = 0),
pn AS (
  SELECT postId, argMax(nicheId, (ifNull(score, -1), toString(nicheId))) AS nicheId
  FROM livePostNiche WHERE rank = 1 GROUP BY postId),
nc AS (
  SELECT id,
         argMax(slug, _version) AS slug,
         argMax(is_deleted, _version) AS del
  FROM api.niche GROUP BY id HAVING del = 0),
du AS (
  SELECT id FROM api.post GROUP BY id
  HAVING argMax(sourceId, _version) IN (${asSqlList(EXCLUDED_SOURCE_IDS)})),
pv AS (
  SELECT id FROM api.post GROUP BY id
  HAVING argMax(private, _version) = 1 AND argMax(sourceId, _version) != 'unknown'),
reg AS (SELECT id FROM api.user GROUP BY id)`;

/**
 * Reads in `(cursor, until]`, deduplicated to one row per (user, post) within the
 * window, grouped into the per-day per-niche counts the growth table stores.
 *
 * Dedup is window-local by design: a post re-read on a later day counts again.
 * Exact lifetime dedup would need a 71M-row (userId, postId) ledger; measured drift
 * from doing it this way is +5.08% platform-wide, so the metric is really
 * "posts per day you engaged with them". See devcraft `docs/SERVING.md`.
 */
export const userWorldDeltaQuery = /* sql */ `
WITH ${worldRulesCte},
firsts AS (
  SELECT e.user_id AS "userId",
         pn.nicheId AS "nicheId",
         eff.eff_id AS pid,
         min(toDate(e.event_timestamp)) AS day
  FROM feed.active_post_events e
  INNER JOIN eff ON e.target_id = eff.id
  INNER JOIN pn ON eff.eff_id = pn.postId
  INNER JOIN nc n ON pn.nicheId = n.id
  INNER JOIN pmeta pm ON eff.eff_id = pm.id
  INNER JOIN reg ON e.user_id = reg.id
  WHERE e.event_timestamp > {cursor: DateTime}
    AND e.event_timestamp <= {until: DateTime}
    AND e.event_name IN (${asSqlList(READ_EVENTS)})
    AND n.slug NOT IN (${asSqlList(EXCLUDED_NICHE_SLUGS)})
    AND eff.eff_id NOT IN (SELECT id FROM du)
    AND eff.eff_id NOT IN (SELECT id FROM pv)
    AND pm.au != e.user_id
    AND pm.sc != e.user_id
    AND NOT (eff.share_author = e.user_id AND eff.eff_id != eff.id)
  GROUP BY "userId", "nicheId", pid)
SELECT "userId",
       toString(day) AS date,
       toString("nicheId") AS "nicheId",
       toUInt32(count()) AS reads
FROM firsts
GROUP BY "userId", date, "nicheId"
ORDER BY "userId", date, "nicheId"`;
