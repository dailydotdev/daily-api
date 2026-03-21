import { z } from 'zod';

const addOrderingModeValidation = <
  T extends {
    rank?: number;
    highlightedAt?: string;
  },
>(
  value: T,
  ctx: z.RefinementCtx,
): void => {
  if (value.rank !== undefined && value.highlightedAt !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['highlightedAt'],
      message: 'highlightedAt cannot be provided together with rank',
    });
  }
};

export const postHighlightItemSchema = z
  .object({
    postId: z.string().min(1),
    headline: z.string().min(1).max(200),
    rank: z.number().int().min(1).optional(),
    highlightedAt: z.string().datetime().optional(),
    significanceLabel: z.string().min(1).optional().nullable(),
    reason: z.string().min(1).optional().nullable(),
  })
  .superRefine(addOrderingModeValidation);

export const setHighlightsSchema = z
  .array(postHighlightItemSchema)
  .max(20)
  .superRefine((items, ctx) => {
    const postIds = new Set<string>();
    const highlightedAtCount = items.filter(
      (item) => item.highlightedAt !== undefined,
    ).length;

    items.forEach((item, index) => {
      if (postIds.has(item.postId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'postId'],
          message: 'postId must be unique within a channel highlight payload',
        });
      }

      postIds.add(item.postId);
    });

    if (highlightedAtCount > 0 && highlightedAtCount !== items.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'highlightedAt must be provided for every item when using timestamp ordering',
      });
    }
  });

export const updateHighlightSchema = z
  .object({
    rank: z.number().int().min(1).optional(),
    highlightedAt: z.string().datetime().optional(),
    headline: z.string().min(1).max(200).optional(),
    significanceLabel: z.string().min(1).optional().nullable(),
    reason: z.string().min(1).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    addOrderingModeValidation(value, ctx);

    if (
      ![
        value.rank,
        value.highlightedAt,
        value.headline,
        value.significanceLabel,
        value.reason,
      ].some((field) => field !== undefined)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'at least one field must be provided',
      });
    }
  });
