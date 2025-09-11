import z from 'zod';

export const userCandidateCVSchema = z.object({
  blob: z.string().optional(),
  contentType: z.string().optional(),
  bucket: z.string().optional(),
  lastModified: z.date().optional(),
});

export type UserCandidateCV = z.infer<typeof userCandidateCVSchema>;
