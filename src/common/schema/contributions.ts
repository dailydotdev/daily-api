import z from 'zod';
import { ContributionAssistType } from '../../entity/contribution/ContributionAction';
import { ContributionRewardType } from '../../entity/contribution/ContributionRewardTier';
import { ContributionSubmissionStatus } from '../../entity/contribution/ContributionSubmission';
import { enumValues } from './utils';

export const contributionActionEvidenceSchema = z
  .object({
    url: z
      .object({
        required: z.boolean().nullish(),
        allowedDomains: z.array(z.string().trim().min(1)).nullish(),
      })
      .nullish(),
    screenshot: z
      .object({
        required: z.boolean().nullish(),
      })
      .nullish(),
    note: z
      .object({
        required: z.boolean().nullish(),
      })
      .nullish(),
  })
  .strict();

export const contributionActionMetadataSchema = z
  .object({
    platform: z.string().trim().min(1).optional(),
    instructions: z.string().trim().min(1).optional(),
    externalUrl: z.url().optional(),
    isLoveAction: z.boolean().optional(),
    assistType: z.enum(enumValues(ContributionAssistType)).optional(),
  })
  .strict();

export const contributionSubmissionEvidenceSchema = z
  .object({
    url: z.url().nullish(),
    screenshotUrl: z.url().nullish(),
    note: z.string().trim().max(1000).nullish(),
  })
  .strict();

export const contributionConnectionArgsSchema = z.object({
  first: z.number().int().positive().max(100).nullish(),
  after: z.string().nullish(),
});

export const contributionActionsArgsSchema =
  contributionConnectionArgsSchema.extend({
    categoryId: z.uuid().nullish(),
  });

export const contributionSubmissionsArgsSchema =
  contributionConnectionArgsSchema.extend({
    actionId: z.uuid().nullish(),
  });

export const contributionActionLinksArgsSchema = z.object({
  actionId: z.uuid(),
  limit: z.number().int().positive().max(20).nullish(),
});

export const submitContributionActionInputSchema = z.object({
  actionId: z.uuid(),
  evidence: contributionSubmissionEvidenceSchema,
});

export const updateContributionCausePreferencesArgsSchema = z.object({
  causeIds: z.array(z.uuid()).max(50),
});

export const suggestContributionCauseArgsSchema = z.object({
  url: z.url(),
  note: z.string().trim().min(1).max(1000).nullish(),
});

export const claimContributionRewardArgsSchema = z.object({
  tierId: z.uuid(),
});

export const contributionCoresRewardMetadataSchema = z
  .object({
    amount: z.number().int().positive(),
  })
  .strict();

export const contributionPlusDaysRewardMetadataSchema = z
  .object({
    days: z.number().int().positive(),
  })
  .strict();

export const contributionStoreDiscountRewardMetadataSchema = z
  .object({
    percent: z.number().int().positive().max(100),
  })
  .strict();

const contributionMetadataSchema = z
  .object({})
  .catchall(z.unknown())
  .optional();

const contributionFlagsSchema = z.object({}).catchall(z.unknown()).optional();

const contributionSortOrderSchema = z.number().int().optional();

const contributionActiveSchema = z.boolean().optional();

const contributionUserIdSchema = z.string().trim().min(1).max(36);

export const contributionPrivateIdParamsSchema = z.object({
  id: z.uuid(),
});

export const contributionPrivateRewardParamsSchema = z.object({
  userId: contributionUserIdSchema,
  tierId: z.uuid(),
});

export const contributionPrivateBlockedUserParamsSchema = z.object({
  userId: contributionUserIdSchema,
});

export const contributionPrivateCreateActionCategorySchema = z.object({
  title: z.string().trim().min(1),
  active: contributionActiveSchema,
  sortOrder: contributionSortOrderSchema,
});

export const contributionPrivateUpdateActionCategorySchema = z.object({
  title: z.string().trim().min(1).optional(),
  active: contributionActiveSchema,
  sortOrder: contributionSortOrderSchema,
});

export const contributionPrivateCreateActionSchema = z.object({
  categoryId: z.uuid().nullish(),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).nullish(),
  points: z.number().int().min(0),
  evidence: contributionActionEvidenceSchema.optional(),
  metadata: contributionActionMetadataSchema.optional(),
  cooldownSeconds: z.number().int().positive().nullish(),
  maxPerUser: z.number().int().positive().nullish(),
  active: contributionActiveSchema,
  sortOrder: contributionSortOrderSchema,
});

export const contributionPrivateUpdateActionSchema = z.object({
  categoryId: z.uuid().nullish(),
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).nullish(),
  points: z.number().int().min(0).optional(),
  evidence: contributionActionEvidenceSchema.optional(),
  metadata: contributionActionMetadataSchema.optional(),
  cooldownSeconds: z.number().int().positive().nullish(),
  maxPerUser: z.number().int().positive().nullish(),
  active: contributionActiveSchema,
  sortOrder: contributionSortOrderSchema,
});

export const contributionPrivateCreateCauseSchema = z.object({
  title: z.string().trim().min(1),
  url: z.url().nullish(),
  description: z.string().trim().min(1).nullish(),
  category: z.string().trim().min(1).nullish(),
  logoUrl: z.url().nullish(),
  active: contributionActiveSchema,
  sortOrder: contributionSortOrderSchema,
});

export const contributionPrivateUpdateCauseSchema = z.object({
  title: z.string().trim().min(1).optional(),
  url: z.url().nullish(),
  description: z.string().trim().min(1).nullish(),
  category: z.string().trim().min(1).nullish(),
  logoUrl: z.url().nullish(),
  active: contributionActiveSchema,
  sortOrder: contributionSortOrderSchema,
});

export const contributionPrivateCreateSponsorSchema = z.object({
  name: z.string().trim().min(1),
  amountCents: z.number().int().positive(),
  url: z.url().nullish(),
  logoUrl: z.url().nullish(),
  active: contributionActiveSchema,
  sortOrder: contributionSortOrderSchema,
});

export const contributionPrivateUpdateSponsorSchema = z.object({
  name: z.string().trim().min(1).optional(),
  amountCents: z.number().int().positive().optional(),
  url: z.url().nullish(),
  logoUrl: z.url().nullish(),
  active: contributionActiveSchema,
  sortOrder: contributionSortOrderSchema,
});

export const contributionPrivateCreateMilestoneSchema = z.object({
  value: z.number().int().positive(),
  title: z.string().trim().min(1).nullish(),
});

export const contributionPrivateCreateRewardTierSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).nullish(),
  thresholdPoints: z.number().int().positive(),
  rewardType: z.enum(enumValues(ContributionRewardType)),
  metadata: contributionMetadataSchema,
  active: contributionActiveSchema,
  sortOrder: contributionSortOrderSchema,
});

export const contributionPrivateUpdateRewardTierSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).nullish(),
  thresholdPoints: z.number().int().positive().optional(),
  rewardType: z.enum(enumValues(ContributionRewardType)).optional(),
  metadata: contributionMetadataSchema,
  active: contributionActiveSchema,
  sortOrder: contributionSortOrderSchema,
});

export const contributionPrivateReviewSubmissionSchema = z.object({
  status: z.enum(enumValues(ContributionSubmissionStatus)),
  awardedPoints: z.number().int().min(0).optional(),
  flags: contributionFlagsSchema,
  reviewedBy: contributionUserIdSchema.nullish(),
});

export const contributionPrivateFulfillRewardSchema = z.object({
  fulfilledAt: z.coerce.date().nullish(),
});

export const contributionPrivateBlockUserSchema = z.object({
  userId: contributionUserIdSchema,
  reason: z.string().trim().min(1).nullish(),
});

export const contributionPrivateFinalizePaymentSchema = z.object({
  amountCents: z.number().int().positive(),
  createdBy: contributionUserIdSchema.nullish(),
});

export const contributionPrivateCreateActionLinkSchema = z.object({
  url: z.url(),
  label: z.string().trim().min(1).nullish(),
  active: contributionActiveSchema,
  sortOrder: contributionSortOrderSchema,
});

export const contributionPrivateBulkCreateActionLinkSchema = z.object({
  links: z.array(contributionPrivateCreateActionLinkSchema).min(1).max(500),
});

export const contributionPrivateUpdateActionLinkSchema = z.object({
  url: z.url().optional(),
  label: z.string().trim().min(1).nullish(),
  active: contributionActiveSchema,
  sortOrder: contributionSortOrderSchema,
});
