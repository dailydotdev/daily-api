import z from 'zod';

export const userGithubRepositoriesSchema = z.object({
  userId: z.string(),
});
