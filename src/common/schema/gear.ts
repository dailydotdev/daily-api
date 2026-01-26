import z from 'zod';

export const addGearSchema = z.object({
  name: z.string().min(1).max(255),
});

export const reorderGearItemSchema = z.object({
  id: z.uuid(),
  position: z.number().int().min(0),
});

export const reorderGearSchema = z.array(reorderGearItemSchema).min(1);

export type AddGearInput = z.infer<typeof addGearSchema>;
export type ReorderGearInput = z.infer<typeof reorderGearItemSchema>;
