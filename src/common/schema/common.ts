import { z } from 'zod';
// @ts-expect-error - no types
import { FileUpload } from 'graphql-upload/GraphQLUpload.js';

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

export const fileUploadSchema = z.custom<Promise<FileUpload>>();

export const zCoerceStringBoolean = z.preprocess((val) => {
  return val === 'false' ? false : Boolean(val);
}, z.boolean());

export const optionalStringSchema = z
  .string()
  .nullish()
  .transform((v) => v?.trim() || undefined);
