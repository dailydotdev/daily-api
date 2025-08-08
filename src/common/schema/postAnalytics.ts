import { z } from 'zod';

export const postAnalyticsClickhouseSchema = z.object({
  id: z.string(),
  updatedAt: z.coerce.date(),
  impressions: z.coerce.number().nonnegative(),
  reach: z.coerce.number().nonnegative(),
  bookmarks: z.coerce.number().nonnegative(),
  profileViews: z.coerce.number().nonnegative(),
  followers: z.coerce.number().nonnegative(),
  squadJoins: z.coerce.number().nonnegative(),
  sharesExternal: z.coerce.number().nonnegative(),
  sharesInternal: z.coerce.number().nonnegative(),
});
