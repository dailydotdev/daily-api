import z from 'zod';
import { AutocompleteType } from '../../entity/Autocomplete';
import { CompanyType } from '../../entity/Company';
import { normalizeContentForDeduplication } from '../../entity/posts/hooks';

export enum LocationDataset {
  Internal = 'internal',
  External = 'external',
}

export const autocompleteBaseSchema = z.object({
  query: z.string().trim().toLowerCase().normalize().min(1).max(100).nonempty(),
  limit: z.number().min(1).max(50).default(20),
});

export const autocompleteSchema = autocompleteBaseSchema.extend({
  type: z.enum(AutocompleteType),
});

export const autocompleteCompanySchema = autocompleteBaseSchema.extend({
  type: z.enum(CompanyType).optional(),
});

export const autocompleteKeywordsSchema = z.object({
  query: z.string().transform(normalizeContentForDeduplication),
  limit: z.number().min(1).max(50).default(20),
});

export const autocompleteLocationSchema = z.object({
  query: z.string().trim().toLowerCase().normalize().min(1).nonempty(),
  limit: z.number().min(1).max(50).default(5),
  dataset: z.enum(LocationDataset).default(LocationDataset.External),
});
