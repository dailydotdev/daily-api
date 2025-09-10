import z from 'zod';

export const userCandidateCVSchema = z.object({
  bucket: z.string().optional(),
  blob: z.string().optional(),
  lastModified: z.date().optional(),
});

export type UserCandidateCV = z.infer<typeof userCandidateCVSchema>;
