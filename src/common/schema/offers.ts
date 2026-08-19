import z from 'zod';

export const confirmOffersDeliveredSchema = z.object({
  impressionUids: z.array(z.uuid()).min(1).max(10),
});
