import z from 'zod';

export const addSourceStackSchema = z.object({
  title: z.string().min(1).max(255),
});

export const updateSourceStackSchema = z.object({
  icon: z.string().max(50).optional(),
  title: z.string().min(1).max(255).optional(),
});

export const reorderSourceStackItemSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().min(0),
});

export const reorderSourceStackSchema = z
  .array(reorderSourceStackItemSchema)
  .min(1);

export type AddSourceStackInput = z.infer<typeof addSourceStackSchema>;
export type UpdateSourceStackInput = z.infer<typeof updateSourceStackSchema>;
export type ReorderSourceStackInput = z.infer<
  typeof reorderSourceStackItemSchema
>;
