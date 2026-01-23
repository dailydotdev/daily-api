import z from 'zod';

export const addUserGearSchema = z.object({
  name: z.string().min(1).max(255),
});

export const reorderUserGearItemSchema = z.object({
  id: z.uuid(),
  position: z.number().int().min(0),
});

export const reorderUserGearSchema = z.array(reorderUserGearItemSchema).min(1);

export type AddUserGearInput = z.infer<typeof addUserGearSchema>;
export type ReorderUserGearInput = z.infer<typeof reorderUserGearItemSchema>;
