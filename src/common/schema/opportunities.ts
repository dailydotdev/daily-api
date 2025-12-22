import { OpportunityState } from '@dailydotdev/schema';
import z from 'zod';
import { organizationLinksSchema } from './organizations';
import { fileUploadSchema, urlParseSchema } from './common';
import { parseBigInt } from '../utils';
import { OpportunityMatchStatus } from '../../entity/opportunities/types';
import { SubscriptionCycles } from '../../paddle';
import { SubscriptionProvider, SubscriptionStatus } from '../plus/subscription';

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
  const contentSchema = z.string().max(2000);

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

export const opportunityCreateSchema = z.object({
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
  location: z
    .array(
      z.object({
        country: z.string().nonempty().max(240),
        city: z.string().nonempty().max(240).optional(),
        subdivision: z.string().nonempty().max(240).optional(),
        type: z.coerce.number().min(1),
        iso2: z.string().nonempty().max(2).optional(),
      }),
    )
    .optional(),
  organizationId: z.string(),
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
});

export const opportunityCreateParseSchema = opportunityCreateSchema
  .omit({ organizationId: true })
  .extend({
    keywords: z.preprocess((val) => {
      if (Array.isArray(val)) {
        return val.map((keyword) => {
          return {
            keyword,
          };
        });
      }

      return val;
    }, opportunityCreateSchema.shape.keywords),
    meta: opportunityCreateSchema.shape.meta
      .extend({
        teamSize: opportunityCreateSchema.shape.meta.shape.teamSize.optional(),
        salary: z
          .object({
            min: z.preprocess((val: bigint) => {
              if (typeof val === 'undefined') {
                return val;
              }

              return parseBigInt(val);
            }, z.number().int().nonnegative().max(100_000_000).optional()),
            max: z.preprocess((val: bigint) => {
              if (typeof val === 'undefined') {
                return val;
              }

              return parseBigInt(val);
            }, z.number().int().nonnegative().max(100_000_000).optional()),
            period: z.number(),
          })
          .partial()
          .optional(),
      })
      .partial(),
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
    externalLocationId: z.preprocess(
      (val) => (val === '' ? null : val),
      z.string().nullish().default(null),
    ),
    locationType: z.coerce.number().nullish().default(null),
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
        .optional()
        .refine(
          (data) => {
            if (data?.min && data?.max) {
              return data.max >= data.min && data.max <= data.min * 1.25;
            }

            return true;
          },
          {
            error:
              'Min salary must be less than or equal to max salary and no more than 25% lower',
          },
        ),
      seniorityLevel: z.number(),
      roleType: z.union([z.literal(0), z.literal(0.5), z.literal(1)]),
    }),
    content: opportunityContentSchema.partial(),
    questions: z
      .array(
        z.object({
          id: z.uuid().optional(),
          title: z.string().nonempty().max(480, {
            error: 'Question title is too long',
          }),
          placeholder: z
            .string()
            .max(480, {
              error: 'Placeholder is too long',
            })
            .nullable()
            .optional(),
        }),
      )
      .min(1, {
        error: 'At least one question is required',
      })
      .max(3, {
        error: 'No more than three questions are allowed',
      }),
    organization: z
      .object({
        name: z.string().nonempty().max(60).optional(),
        website: z.string().max(500).nullish(),
        description: z.string().max(2000).nullish(),
        perks: z.array(z.string().max(240)).max(50).nullish(),
        founded: z.number().int().min(1800).max(2100).nullish(),
        externalLocationId: z.string().max(500).nullish(),
        category: z.string().max(240).nullish(),
        size: z.number().int().nullish(),
        stage: z.number().int().nullish(),
        links: z.array(organizationLinksSchema).max(50).optional(),
      })
      .nullish(),
    recruiter: z.object({
      userId: z.string(),
      title: z.string().max(240).optional(),
      bio: z.string().max(2000).optional(),
    }),
  })
  .partial();

export const opportunityStateLiveSchema = opportunityEditSchema.extend({
  content: opportunityContentSchema,
});

export const opportunityUpdateStateSchema = z.object({
  id: z.uuid(),
  state: z.enum(OpportunityState),
});

export const parseOpportunitySchema = z
  .object({
    url: urlParseSchema.optional(),
    file: fileUploadSchema.optional(),
  })
  .refine(
    (data) => {
      if (!data.url && !data.file) {
        return false;
      }

      return true;
    },
    {
      error: 'Either url or file must be provided.',
    },
  )
  .refine(
    (data) => {
      if (data.url && data.file) {
        return false;
      }

      return true;
    },
    {
      error: 'Only one of url or file can be provided.',
    },
  );

export const createSharedSlackChannelSchema = z.object({
  organizationId: z.string().uuid('Organization ID must be a valid UUID'),
  email: z.string().email('Email must be a valid email address'),
  channelName: z
    .string()
    .min(1, 'Channel name is required')
    .max(80, 'Channel name must be 80 characters or less')
    .regex(
      /^[a-z0-9-_]+$/,
      'Channel name can only contain lowercase letters, numbers, hyphens, and underscores',
    ),
});

export const opportunityMatchesQuerySchema = z.object({
  opportunityId: z.string(),
  status: z
    .enum([
      OpportunityMatchStatus.CandidateAccepted,
      OpportunityMatchStatus.RecruiterAccepted,
      OpportunityMatchStatus.RecruiterRejected,
    ])
    .optional(),
  after: z.string().optional(),
  first: z.number().optional(),
});

export const recruiterSubscriptionFlagsSchema = z
  .object({
    subscriptionId: z.string({
      error: 'Subscription ID is required',
    }),
    cycle: z
      .enum(SubscriptionCycles, {
        error: 'Invalid subscription cycle',
      })
      .nullish(),
    createdAt: z.preprocess((value) => new Date(value as string), z.date()),
    updatedAt: z.preprocess((value) => new Date(value as string), z.date()),
    provider: z.enum(SubscriptionProvider, {
      error: 'Invalid subscription provider',
    }),
    status: z.enum(SubscriptionStatus, {
      error: 'Invalid subscription status',
    }),
    items: z.array(
      z.object({
        priceId: z.string({
          error: 'Price ID is required',
        }),
        quantity: z.number().int().min(1, {
          error: 'Quantity must be at least 1',
        }),
      }),
      {
        error: 'At least one subscription item is required',
      },
    ),
    hasSlackConnection: z.boolean().optional(),
  })
  .partial();

export const gondulOpportunityPreviewResultSchema = z.object({
  user_ids: z.array(z.string()),
  total_count: z.number().int().nonnegative(),
});

export const maxRecruiterSeats = 50;

export const addOpportunitySeatsSchema = z.object({
  seats: z
    .array(
      z.object({
        priceId: z.string().nonempty('Select a price option'),
        quantity: z
          .number()
          .nonnegative()
          .min(1, 'Enter the number of seats')
          .max(maxRecruiterSeats, {
            error: `You can add up to ${maxRecruiterSeats} seats at a time`,
          }),
      }),
      {
        error: 'At least one seat is required',
      },
    )
    .min(1, {
      error: 'At least one seat is required',
    })
    // number of pricing ids that can be in cart, just arbitrarily limit to 10
    .max(10, {
      error: 'You can add up to 10 different price options at a time',
    }),
});
