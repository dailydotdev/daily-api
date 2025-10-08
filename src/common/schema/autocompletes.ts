import z from 'zod';
import { normalizeContentForDeduplication } from '../../entity/posts/hooks';
import { AutocompleteType } from '../../entity';

export const autocompleteBaseSchema = z.object({
  query: z.string().transform(normalizeContentForDeduplication),
  limit: z.number().min(1).max(50).default(20),
});

export const autocompleteSchema = autocompleteBaseSchema.extend({
  type: z.enum(AutocompleteType),
});
