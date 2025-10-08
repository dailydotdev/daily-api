import { OpportunityState } from '@dailydotdev/schema';
import z from 'zod';

export const opportunityMatchDescriptionSchema = z.object({
  reasoning: z.string(),
  reasoningShort: z.string(),
  matchScore: z.number(),
});

export const createOpportunityEditContentSchema = ({
  optional = false,
}: {
  optional?: boolean;
} = {}) => {
  const contentSchema = z.string().max(1440);

  return z.object({
    content: optional ? contentSchema.optional() : contentSchema.nonempty(),
  });
};

export const applicationScoreSchema = z.object({
  score: z.number().min(0).max(100).optional(),
  description: z.string().optional(),
  warmIntro: z.string().optional(),
});

export const opportunityContentSchema = z.object({
  overview: createOpportunityEditContentSchema(),
  responsibilities: createOpportunityEditContentSchema(),
  requirements: createOpportunityEditContentSchema(),
  whatYoullDo: createOpportunityEditContentSchema({
    optional: true,
  }).optional(),
  interviewProcess: createOpportunityEditContentSchema({
    optional: true,
  }).optional(),
});

export const opportunityEditSchema = z
  .object({
    title: z.string().nonempty().max(240),
    tldr: z.string().nonempty().max(480),
    keywords: z
      .array(
        z.object({
          keyword: z.string().nonempty().trim(),
        }),
      )
      .min(1)
      .max(100),
    location: z.array(
      z.object({
        country: z.string().nonempty().max(240),
        city: z.string().nonempty().max(240).optional(),
        subdivision: z.string().nonempty().max(240).optional(),
        type: z.coerce.number().min(1),
      }),
    ),
    meta: z.object({
      employmentType: z.coerce.number().min(1),
      teamSize: z.number().int().nonnegative().min(1).max(1_000_000),
      salary: z
        .object({
          min: z.number().int().nonnegative().max(100_000_000),
          max: z.number().int().nonnegative().max(100_000_000),
          period: z.number(),
        })
        .partial()
        .optional(),
      seniorityLevel: z.number(),
      roleType: z.union([z.literal(0), z.literal(0.5), z.literal(1)]),
    }),
    content: opportunityContentSchema.partial(),
    questions: z
      .array(
        z.object({
          id: z.uuid().optional(),
          title: z.string().nonempty().max(480),
          placeholder: z.string().max(480).nullable().optional(),
        }),
      )
      .min(1)
      .max(3),
  })
  .partial();

export const opportunityStateLiveSchema = opportunityEditSchema.extend({
  content: opportunityContentSchema,
});

export const opportunityUpdateStateSchema = z.object({
  id: z.uuid(),
  state: z.enum(OpportunityState),
});
