import { z } from 'zod';
import { TagChipSeedStrategy } from '../../types';
import { enumValues } from './utils';

export const feedListInputSchema = z.object({
  includeTagChipFeeds: z
    .boolean()
    .nullish()
    .transform((value) => value ?? false),
  tagChipSeedStrategy: z
    .enum(enumValues(TagChipSeedStrategy))
    .nullish()
    .transform((value) => value ?? TagChipSeedStrategy.V1),
});
