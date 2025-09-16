import z from 'zod';
import { normalizeContentForDeduplication } from '../../entity/posts/hooks';

export const autocompleteKeywordsSchema = z.object({
  query: z.string().transform(normalizeContentForDeduplication),
  limit: z.number().min(1).max(100).default(20),
});
