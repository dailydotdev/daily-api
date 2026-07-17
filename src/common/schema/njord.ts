import { z } from 'zod';

export const sayThanksForAwardSchema = z.object({
  transactionId: z.uuid('Invalid transaction id provided'),
});
