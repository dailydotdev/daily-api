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

const urlStartRegexMatch = /^https?:\/\//;

// match http(s) urls and partials like daily.dev (without protocol )
export const urlParseSchema = z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      return val.match(urlStartRegexMatch) ? val : `https://${val}`;
    }

    return val;
  },
  z.url({
    protocol: /^https?$/,
    hostname: z.regexes.domain,
    normalize: true,
  }),
);
