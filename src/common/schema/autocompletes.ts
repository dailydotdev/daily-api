import z from 'zod';
import { AutocompleteType } from '../../entity/Autocomplete';

export const autocompleteSchema = z.object({
  type: z.enum(AutocompleteType),
  query: z.string().trim().toLowerCase().normalize(),
  limit: z.number().min(1).max(50).default(20),
});
