import { z } from 'zod';
import {
  CREST_DIVISIONS,
  LOOK_FORKED_ID,
  LOOK_KNOB_RANGES,
  LOOK_NAME_MAX_LENGTH,
  LOOK_PRESETS,
  SKY_HOURS,
  SKY_PALETTES,
  WORLD_NAME_MAX_LENGTH,
} from '../worldStyle';

export const userWorldDeltaSchema = z.strictObject({
  userId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nicheId: z.string().uuid(),
  reads: z.coerce.number().int().positive(),
});

export type UserWorldDelta = z.infer<typeof userWorldDeltaSchema>;

const hexColourSchema = z.int().min(0).max(0xffffff);

const knobSchema = (key: keyof typeof LOOK_KNOB_RANGES) =>
  z.number().min(LOOK_KNOB_RANGES[key].min).max(LOOK_KNOB_RANGES[key].max);

export const worldSkySchema = z.strictObject({
  pal: z.literal(SKY_PALETTES),
  hour: z.literal(SKY_HOURS),
});

/**
 * Shape only. Whether a charge and its tinctures were actually EARNED cannot be
 * decided from the payload — that gate reads the user's districts and lives in
 * the resolver. Note there is no charge enum here: an unearned charge is
 * rejected there anyway, and every earned charge is by construction a real one,
 * so a second list would only be a copy that could drift.
 */
export const worldCrestSchema = z.strictObject({
  charge: z.string().min(1).max(24),
  div: z.literal(CREST_DIVISIONS),
  a: hexColourSchema,
  b: hexColourSchema,
});

/**
 * A look is committed whole rather than patched, for the same reason a crest
 * is: until somebody touches it there is no stored look at all, so writing a
 * single knob onto nothing would save a slider with no preset under it.
 *
 * `base` accepts only real presets — `mine` is what a preset becomes when a
 * knob moves, so a fork of a fork still points back at something revertible.
 */
export const worldLookSchema = z.strictObject({
  id: z.literal([...LOOK_PRESETS, LOOK_FORKED_ID]),
  base: z.literal(LOOK_PRESETS),
  mine: z.boolean(),
  name: z.string().max(LOOK_NAME_MAX_LENGTH),
  ol: knobSchema('ol'),
  bl: knobSchema('bl'),
  duo: knobSchema('duo'),
  warm: knobSchema('warm'),
  sat: knobSchema('sat'),
  grain: knobSchema('grain'),
  vig: knobSchema('vig'),
  lift: z.number().min(0).max(1),
  duoA: hexColourSchema,
  duoB: hexColourSchema,
  ink: hexColourSchema,
  fx: z.strictObject({
    post: z.boolean(),
    bloom: z.boolean(),
    outline: z.boolean(),
  }),
});

/**
 * A patch. An absent key leaves that customisation alone; an explicit null
 * clears it back to the derived suggestion, which is how the ↺ buttons undo a
 * name or a fork without needing a second mutation.
 */
export const worldSettingsUpdateSchema = z.strictObject({
  name: z.string().trim().max(WORLD_NAME_MAX_LENGTH).nullish(),
  sky: worldSkySchema.nullish(),
  crest: worldCrestSchema.nullish(),
  look: worldLookSchema.nullish(),
  private: z.boolean().optional(),
});
