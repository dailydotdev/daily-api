import z from 'zod';

export const pollCreationSchema = z.object({
  title: z.string().max(250),
  sourceId: z.string(),
  duration: z
    .union([
      z.literal(1),
      z.literal(3),
      z.literal(7),
      z.literal(14),
      z.literal(30),
    ])
    .optional(),
  options: z
    .array(
      z.object({
        text: z.string().min(1).max(35),
        order: z.number().min(0).max(4),
      }),
    )
    .min(2)
    .max(4),
});
