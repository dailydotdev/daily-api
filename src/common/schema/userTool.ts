import z from 'zod';

export const addUserToolSchema = z.object({
  title: z.string().min(1).max(255),
  category: z.string().min(1).max(100),
});

export const updateUserToolSchema = z.object({
  category: z.string().min(1).max(100).optional(),
});

export const reorderUserToolItemSchema = z.object({
  id: z.uuid(),
  position: z.number().int().min(0),
});

export const reorderUserToolSchema = z.array(reorderUserToolItemSchema).min(1);

export type AddUserToolInput = z.infer<typeof addUserToolSchema>;
export type UpdateUserToolInput = z.infer<typeof updateUserToolSchema>;
export type ReorderUserToolInput = z.infer<typeof reorderUserToolItemSchema>;
