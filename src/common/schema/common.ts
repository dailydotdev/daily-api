import { z } from 'zod';

/**
 * Common pagination arguments schema for cursor-based pagination
 * Use with .extend() to add to your query schemas
 */
export const paginationSchema = z.object({
  /**
   * Paginate after opaque cursor
   */
  after: z.string().optional(),
  /**
   * Number of items to return (first N items)
   */
  first: z.number().max(100).optional().default(10),
});

export type PaginationArgs = z.infer<typeof paginationSchema>;
