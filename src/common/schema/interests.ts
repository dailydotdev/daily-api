import z from 'zod';

export const createInterestSchema = z.object({
  query: z.string().min(1).max(500),
});

export const interestIdSchema = z.object({
  id: z.string().min(1),
});

export const sendInterestCommandSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(2000),
});
