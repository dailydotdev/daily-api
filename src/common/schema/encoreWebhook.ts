import z from 'zod';

export const encoreOfferCompletedSchema = z.object({
  event: z.literal('offer_completed'),
  timestamp: z.string().datetime(),
  transactionId: z.uuid(),
  userId: z.string().min(1),
  campaignName: z.string(),
  payout: z.number().nullable(),
});
