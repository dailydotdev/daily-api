import z from 'zod';

export enum AutocompleteType {
  FieldOfStudy = 'field_of_study',
  Degree = 'degree',
  Role = 'role',
  Skill = 'skill',
}

export const autocompleteBaseSchema = z.object({
  query: z.string().trim().min(1).toLowerCase().normalize(),
  limit: z.number().min(1).max(50).default(20),
});

export const autocompleteSchema = autocompleteBaseSchema.extend({
  type: z.enum(AutocompleteType),
});
