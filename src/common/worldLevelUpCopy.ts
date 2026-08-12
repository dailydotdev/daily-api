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

const BANDS: CopyBand[] = [
  {
    // L1-L4: five articles or fewer. Barely anything on the ground yet, and
    // the lines say so. Overselling a pile of rocks is how a reader learns to
    // stop believing the next one.
    upTo: 4,
    lines: [
      "It's mostly rocks so far.",
      "Tiny, but it's there.",
      'Every district starts out like this.',
    ],
  },
  {
    // L5-L8: ten to eighty. Roofs went up at L4, so every rung in this band
    // has them.
    upTo: 8,
    lines: [
      "It's got roofs now.",
      "That one's turning into an actual place.",
      'Enough reading to fill a town.',
    ],
  },
  {
    // L9-L11: a hundred and sixty upwards. L9 is where the ladder's own notes
    // say a district becomes legible from across the map, and nothing above it
    // gets smaller.
    upTo: 11,
    lines: [
      'You can spot that one from anywhere on the map.',
      "Every rung is double the last, so that's a serious pile of reading.",
      'Towers and bridges up there now.',
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
  seed,
}: {
  level: number;
  seed: string;
}): string => {
  const band = BANDS.find((item) => level <= item.upTo) ?? BANDS[0];

  return band.lines[hash(seed) % band.lines.length];
};
