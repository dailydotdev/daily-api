import z from 'zod';

// GraphQL DateTime scalar passes Date objects, but we may also receive strings
const dateTimeSchema = z.union([z.string().datetime(), z.date()]);

export const addUserStackSchema = z.object({
  title: z.string().min(1).max(255),
  section: z.string().min(1).max(100),
  startedAt: dateTimeSchema.optional(),
});

export const updateUserStackSchema = z.object({
  section: z.string().min(1).max(100).optional(),
  icon: z.string().max(50).optional(),
  title: z.string().min(1).max(255).optional(),
  startedAt: dateTimeSchema.nullish(),
});

export const reorderUserStackItemSchema = z.object({
  id: z.uuid(),
  position: z.number().int().min(0),
});

export const reorderUserStackSchema = z
  .array(reorderUserStackItemSchema)
  .min(1);

export type AddUserStackInput = z.infer<typeof addUserStackSchema>;
export type UpdateUserStackInput = z.infer<typeof updateUserStackSchema>;
export type ReorderUserStackInput = z.infer<typeof reorderUserStackItemSchema>;
