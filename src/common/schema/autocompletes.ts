import z from 'zod';
import { AutocompleteType } from '../../entity/Autocomplete';

export const autocompleteBaseSchema = z.object({
  query: z.string().trim().min(1).toLowerCase().normalize(),
  limit: z.number().min(1).max(50).default(20),
});

export const autocompleteSchema = autocompleteBaseSchema.extend({
  type: z.enum(AutocompleteType),
});
