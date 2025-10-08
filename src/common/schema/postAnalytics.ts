import { format } from 'date-fns';
import { z } from 'zod';

export const postAnalyticsClickhouseSchema = z.strictObject({
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
  impressionsAds: z.coerce.number().nonnegative(),
  reachAds: z.coerce.number().nonnegative(),
  reachAll: z.coerce.number().nonnegative(),
  clicks: z.coerce.number().nonnegative(),
  clicksAds: z.coerce.number().nonnegative(),
});

export const postAnalyticsHistoryClickhouseSchema = z.strictObject({
  id: z.string(),
  updatedAt: z.coerce.date(),
  impressions: z.coerce.number().nonnegative(),
  date: z.coerce.date().transform((date) => format(date, 'yyyy-MM-dd')),
  impressionsAds: z.coerce.number().nonnegative(),
});
