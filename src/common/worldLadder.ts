/**
 * The twelve-step district ladder, server side.
 *
 * A deliberate duplicate of `LEVELS` in the webapp's
 * `packages/webapp/components/world/ladder.ts`, which is where the rungs are
 * authored and where the reasoning behind their spacing lives. Nothing here
 * draws a world, so only the thresholds cross over — not the build names, not
 * the art notes, not the realm divisor.
 *
 * The two copies have to agree. A reader told a district reached L7 who then
 * opens a world that draws it at L6 has caught us lying about their own
 * history, which is worse than never having told them. Change a threshold in
 * both repos, and ship the webapp first: the world drawing a rung early is
 * invisible, the notification claiming one early is not.
 */
const LEVEL_READS = [1, 2, 3, 5, 10, 20, 40, 80, 160, 320, 640, 1280];

/**
 * Which rung a lifetime read count sits on. 0 for untouched ground.
 *
 * Thresholds ascend, so the first one the count fails is the answer.
 */
export const districtLevelOf = (reads: number): number => {
  if (reads <= 0) {
    return 0;
  }

  const below = LEVEL_READS.findIndex((threshold) => reads < threshold);

  return below === -1 ? LEVEL_READS.length : below;
};

/**
 * Articles still to read in a niche before its district climbs another rung.
 * 0 at the top of the ladder, which has nothing above it.
 */
export const readsToNextLevel = (reads: number): number => {
  const level = districtLevelOf(reads);

  if (level >= LEVEL_READS.length) {
    return 0;
  }

  return LEVEL_READS[level] - reads;
};

/**
 * How many districts a level-up notification names before it starts counting.
 *
 * Two is what a push notification can carry without becoming a list. Everything
 * past them becomes "and N more", so the cron only has to ship the leaders.
 * Three are sent, not two, so a niche deleted between the cron and the worker
 * costs the notification a name rather than its second clause.
 */
export const WORLD_LEVEL_UP_NAMED_DISTRICTS = 2;
export const WORLD_LEVEL_UP_SENT_DISTRICTS = 3;
