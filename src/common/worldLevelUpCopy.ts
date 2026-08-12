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
    // L1-L4: five articles or fewer. The ground has just been claimed.
    upTo: 4,
    lines: [
      'A few reads ago that was bare rock.',
      'Small, but it is yours and it is on the map.',
      'That is another district finding its feet.',
    ],
  },
  {
    // L5-L8: ten to eighty. It reads as built rather than found.
    upTo: 8,
    lines: [
      'That one has stopped looking like a campsite.',
      'It has paths and lanterns now. Go and walk them.',
      'Real buildings, and you read every one of them into place.',
    ],
  },
  {
    // L9-L11: a hundred and sixty upwards. Visible from across the map.
    upTo: 11,
    lines: [
      'You can pick that district out from across the map now.',
      'The rungs double as you climb, so that one took some doing.',
      'It has started growing downward as well as out.',
    ],
  },
  {
    // L12, and nothing above it.
    upTo: 12,
    lines: ['Top of the ladder. There is nothing above it.'],
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
