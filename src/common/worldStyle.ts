/**
 * The two customisations that carry no fact at all: the sky over a world and
 * the film it is photographed through.
 *
 * The sky used to be a readout — whichever realm you had been reading lately
 * owned it. It is given away anyway, because the same fact is already carried
 * permanently by which quarters of the map are large, and the sky is the only
 * channel big enough to make a place feel like yours. Note what is still NOT on
 * offer: land, level, density, monuments. The sky could be given away because
 * losing it costs the portrait nothing; nothing else is that cheap.
 */

/** Nine minus the one that followed your reading, which no longer exists. */
export const SKY_PALETTES = [
  'brand',
  'clear',
  'blossom',
  'ember',
  'seaglass',
  'orchid',
  'harvest',
  'slate',
] as const;

/**
 * The hour moves the sun and nothing moves with it, which is why it is free:
 * the sun is placed once and never animated, so re-aiming it costs one
 * environment repaint and zero per-frame work.
 */
export const SKY_HOURS = ['dawn', 'day', 'gold', 'dusk', 'night'] as const;

/**
 * Six starting points. `mine` is not a preset — it is what a preset becomes the
 * moment a knob is moved, which is why it is accepted here as an id but never
 * as a `base`.
 */
export const LOOK_PRESETS = [
  'diorama',
  'ink',
  'sun',
  'blue',
  'riso',
  'storm',
] as const;

export const LOOK_FORKED_ID = 'mine';

/**
 * Bounds for the seven knobs, straight off the sliders. Everything else on a
 * look is a colour or a flag.
 */
export const LOOK_KNOB_RANGES = {
  ol: { min: 0, max: 1 },
  bl: { min: 0, max: 2.6 },
  duo: { min: 0, max: 1 },
  warm: { min: -1, max: 1 },
  sat: { min: 0, max: 1.6 },
  grain: { min: 0, max: 0.12 },
  vig: { min: 0, max: 0.6 },
} as const;

/**
 * Six ways to cut a shield. A division is pure geometry and encodes nothing, so
 * it lives here with the other free choices rather than with the earned half of
 * the crest.
 */
export const CREST_DIVISIONS = [
  'plain',
  'pale',
  'fess',
  'bend',
  'chevron',
  'quarter',
] as const;

export const WORLD_NAME_MAX_LENGTH = 30;
export const LOOK_NAME_MAX_LENGTH = 22;

/* Where a world starts before anybody touches it is the renderer's business.
   The API stores what was chosen and answers null for what was not, so the
   defaults live once, on the client that has to draw them. */
