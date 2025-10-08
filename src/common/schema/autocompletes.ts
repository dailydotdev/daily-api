import z from 'zod';
import { normalizeContentForDeduplication } from '../../entity/posts/hooks';
import { AutocompleteType } from '../../entity';

export const autocompleteSchema = z.object({
  type: z.enum(AutocompleteType),
  query: z.string().transform(normalizeContentForDeduplication),
  limit: z.number().min(1).max(50).default(20),
});
