/**
 * The line that sits under a level-up, picked from the rung it reached.
 *
 * The title carries the facts and never varies in shape. This is the other
 * half: one sentence of colour that changes with how far up the ladder the
 * district got, and rotates week to week so a reader who levels up often is
 * not read the same sentence every time.
 *
 * Bands rather than twelve separate sets, for the same reason the UI counts
 * rungs instead of naming them: twelve flavours is a vocabulary, four is a
 * mood. The boundaries fall where the ladder's own descriptions change
 * character, from bare ground, to somewhere built, to somewhere you can see
 * coming.
 *
 * The lines lean on what the geometry actually does at that height (see
 * `LEVELS` in the webapp's `components/world/ladder.ts`) and stay vague enough
 * to be true across every rung in their band. A line that promises a dome to a
 * district that has not built one is worse than a line that promises nothing.
 */
type CopyBand = {
  /** Highest rung this band covers. */
  upTo: number;
  lines: string[];
};

/**
 * Replaced with the articles left before the district climbs again.
 *
 * Only used at the bottom of the ladder, and that is a deliberate limit rather
 * than a missing feature. Down there the next rung is one or two articles away
 * and saying so is the most motivating thing available. Higher up the same
 * sentence reads as a wall: a district on L10 needs another 320, and putting
 * that number in front of somebody is a reason to stop reading rather than to
 * carry on. `ladder.ts` makes the same argument about which district to point a
 * reader at, for the same reason.
 */
const TO_NEXT = '{toNext}';

const BANDS: CopyBand[] = [
  {
    // L1-L3, three articles or fewer: a lodestone on bare rock, then stacked
    // stones, then a tended camp with a lantern and a path. Nothing is built
    // yet, so nothing here claims anything is. Overselling a pile of rocks is
    // how a reader learns to discount the next line too.
    upTo: 3,
    lines: [
      `Read ${TO_NEXT} more there and it grows again.`,
      "That's a district on your map now.",
      'It grows every time you read that topic.',
    ],
  },
  {
    // L4-L8. The band opens at L4 because that is where the first roof goes up
    // and the plot, in the ladder's own words, starts reading as built rather
    // than found. Everything above it keeps those buildings, so the lines hold
    // for the whole band.
    upTo: 8,
    lines: [
      "It's got buildings on it now.",
      'Starting to look lived in.',
      "That one's really taking shape.",
    ],
  },
  {
    // L9-L11. L9 is the rung with sky bridges strung between the towers and
    // the first that is legible from across the map; L11 still has its decks
    // and bridges. The article count is the concrete version of "that took
    // some doing": L9 is 160 reads and the band tops out at 640.
    upTo: 11,
    lines: [
      'You can spot that one from anywhere on the map.',
      'Towers and sky bridges up there.',
      "That one's over a hundred articles deep.",
    ],
  },
  {
    // L12, and nothing above it.
    upTo: 12,
    lines: ['Top of the ladder. Nothing above it.'],
  },
];

/**
 * Stable index from a seed string.
 *
 * Deterministic on purpose: a redelivered event has to produce the same
 * sentence it did the first time, or the notification the reader already has
 * open changes its mind. That rules out `Math.random`.
 *
 * FNV-1a with murmur3's finalizer, rather than the more obvious djb2. djb2
 * multiplies by 33, and 33 is divisible by 3, so `djb2(seed) % 3` collapses to
 * the last character of the seed: every reader levelling up in week 33 would
 * have been read the same line, and the variation would only have shown up
 * across weeks. The finalizer is what makes the low bits depend on the whole
 * string rather than its tail.
 */
const hash = (seed: string): number => {
  let value = 2166136261;

  for (let i = 0; i < seed.length; i += 1) {
    value ^= seed.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }

  value ^= value >>> 16;
  value = Math.imul(value, 2246822507);
  value ^= value >>> 13;
  value = Math.imul(value, 3266489909);
  value ^= value >>> 16;

  return value >>> 0;
};

/**
 * `seed` should be stable for one notification and different for the next, so
 * the reader gets a new line each time rather than each render. The user and
 * the week together do that, since a reader only gets one of these a week.
 */
export const worldLevelUpLine = ({
  level,
  toNext,
  seed,
}: {
  level: number;
  /** Articles left before the next rung. 0 at the top of the ladder. */
  toNext: number;
  seed: string;
}): string => {
  const band = BANDS.find((item) => level <= item.upTo) ?? BANDS[0];
  // A line that counts down to the next rung is unusable once there is nothing
  // to count down to, so it drops out of the rotation rather than rendering a
  // zero.
  const usable = band.lines.filter(
    (line) => toNext > 0 || !line.includes(TO_NEXT),
  );

  return usable[hash(seed) % usable.length].replace(TO_NEXT, String(toNext));
};
