import z from 'zod';

export const pollCreationSchema = z.object({
  title: z.string().max(250),
  sourceId: z.string(),
  duration: z.number().min(0).max(30).optional(),
  options: z
    .array(
      z.object({
        text: z.string().max(35),
        order: z.number().min(0),
      }),
    )
    .min(2)
    .max(4),
});
