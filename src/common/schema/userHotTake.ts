import z from 'zod';

export const addUserHotTakeSchema = z.object({
  emoji: z.string().min(1).max(50),
  title: z.string().min(1).max(255),
  subtitle: z.string().max(500).nullish(),
});

export const updateUserHotTakeSchema = z.object({
  emoji: z.string().min(1).max(50).optional(),
  title: z.string().min(1).max(255).optional(),
  subtitle: z.string().max(500).nullish(),
});

export const reorderUserHotTakeItemSchema = z.object({
  id: z.uuid(),
  position: z.number().int().min(0),
});

export const reorderUserHotTakeSchema = z
  .array(reorderUserHotTakeItemSchema)
  .min(1);

export type AddUserHotTakeInput = z.infer<typeof addUserHotTakeSchema>;
export type UpdateUserHotTakeInput = z.infer<typeof updateUserHotTakeSchema>;
export type ReorderUserHotTakeInput = z.infer<
  typeof reorderUserHotTakeItemSchema
>;
