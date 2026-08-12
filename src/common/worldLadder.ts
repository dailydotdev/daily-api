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
 * The lowest rung worth interrupting somebody for.
 *
 * The ladder doubles from L4 up, so its bottom is dense on purpose: L2 is the
 * second article a reader has ever seen in a niche, and L3 the third. Those are
 * rungs the world needs in order to draw a district differently from its
 * neighbour, not events. Notifying on them would fire most days for most
 * readers and say nothing either time, which is how a channel gets muted.
 *
 * L5 is ten articles in one niche. That is a reader who has come back to a
 * subject repeatedly, and it is roughly where the district stops being a camp
 * on bare rock and starts looking built.
 *
 * Raising this is the first knob to reach for if the notification underperforms
 * — it is a constant rather than remote config because crons do not initialise
 * GrowthBook.
 */
export const WORLD_LEVEL_UP_MIN_LEVEL = 5;
