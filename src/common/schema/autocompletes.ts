import z from 'zod';
import { AutocompleteType } from '../../entity/Autocomplete';
import { CompanyType } from '../../entity/Company';

export const autocompleteBaseSchema = z.object({
  query: z.string().trim().min(1).toLowerCase().normalize().nonempty(),
  limit: z.number().min(1).max(50).default(20),
});

export const autocompleteSchema = autocompleteBaseSchema.extend({
  type: z.enum(AutocompleteType),
});

export const autocompleteCompanySchema = autocompleteBaseSchema.extend({
  type: z.enum(CompanyType).optional(),
});
