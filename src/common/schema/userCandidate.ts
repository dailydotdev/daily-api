import z from 'zod';

export const userCandidateCVSchema = z.object({
  bucket: z.string(),
  blob: z.string(),
  lastModified: z.date(),
});
