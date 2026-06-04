import z from 'zod';

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

export const submitContributionActionInputSchema = z.object({
  actionId: z.uuid(),
  evidence: contributionSubmissionEvidenceSchema,
});

export const updateContributionCausePreferencesArgsSchema = z.object({
  causeIds: z.array(z.uuid()).max(50),
});

export const claimContributionRewardArgsSchema = z.object({
  tierId: z.uuid(),
});
