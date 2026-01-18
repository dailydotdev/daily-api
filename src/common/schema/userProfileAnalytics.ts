import { format } from 'date-fns';
import { z } from 'zod';

export const userProfileAnalyticsClickhouseSchema = z.strictObject({
  id: z.string(),
  updatedAt: z.coerce.date(),
  uniqueVisitors: z.coerce.number().nonnegative(),
});

export const userProfileAnalyticsHistoryClickhouseSchema =
  userProfileAnalyticsClickhouseSchema.extend({
    date: z.coerce.date().transform((date) => format(date, 'yyyy-MM-dd')),
  });
