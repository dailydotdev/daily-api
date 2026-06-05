import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import type { EntityManager } from 'typeorm';
import type z from 'zod';
import {
  contributionActionEvidenceSchema,
  contributionSubmissionEvidenceSchema,
} from '../schema/contributions';
import { ContributionBlockedUser } from '../../entity/contribution/ContributionBlockedUser';
import type {
  ContributionAction,
  ContributionEvidenceSchema,
} from '../../entity/contribution/ContributionAction';
import {
  ContributionPayment,
  ContributionPaymentStatus,
} from '../../entity/contribution/ContributionPayment';
import { ContributionSubmissionStatus } from '../../entity/contribution/ContributionSubmission';
import { ContributionSubmission } from '../../entity/contribution/ContributionSubmission';
import { remoteConfig } from '../../remoteConfig';

const ACTIVE_STATUSES_FOR_LIMITS = [
  ContributionSubmissionStatus.Approved,
  ContributionSubmissionStatus.Flagged,
] as const;

type SumRow = {
  sum: string | number | null;
};

type ContributionConfig = {
  enabled: boolean;
  allowedCountries: string[];
  currentCycleTargetPoints: number;
};

type ContributionEligibility = {
  settings: ContributionConfig;
  eligible: boolean;
};

type ContributionActionUsage = {
  count: number;
  latestCreatedAt: Date | null;
};

export const parseContributionArgs = <TSchema extends z.ZodType>(
  schema: TSchema,
  args: unknown,
): z.infer<TSchema> => {
  const result = schema.safeParse(args);
  if (!result.success) {
    throw new ValidationError(
      result.error.issues.map(({ message }) => message).join(', '),
    );
  }

  return result.data;
};

const toContributionInt = (value: string | number | null | undefined): number =>
  Number(value ?? 0);

const getContributionConfig = (): ContributionConfig => {
  const config = remoteConfig.vars.contributionProgram;

  return {
    enabled: config?.enabled ?? false,
    allowedCountries: config?.allowedCountries ?? [],
    currentCycleTargetPoints: config?.currentCycleTargetPoints ?? 0,
  };
};

export const getContributionEligibility = async ({
  con,
  userId,
  region,
}: {
  con: EntityManager;
  userId: string;
  region: string;
}): Promise<ContributionEligibility> => {
  const settings = getContributionConfig();
  if (!settings.enabled || !region) {
    return { settings, eligible: false };
  }

  if (!settings.allowedCountries.includes(region)) {
    return { settings, eligible: false };
  }

  const blocked = await con.getRepository(ContributionBlockedUser).exists({
    where: { userId },
  });

  return { settings, eligible: !blocked };
};

export const assertContributionEligible = async ({
  con,
  userId,
  region,
}: {
  con: EntityManager;
  userId: string;
  region: string;
}): Promise<void> => {
  const { eligible } = await getContributionEligibility({
    con,
    userId,
    region,
  });

  if (!eligible) {
    throw new ForbiddenError('User is not eligible for this program');
  }
};

export const getApprovedPointsSum = async ({
  con,
  userId,
  unpaidOnly = false,
}: {
  con: EntityManager;
  userId?: string;
  unpaidOnly?: boolean;
}): Promise<number> => {
  const builder = con
    .getRepository(ContributionSubmission)
    .createQueryBuilder('submission')
    .select('COALESCE(SUM(submission."awardedPoints"), 0)', 'sum')
    .where('submission.status = :status', {
      status: ContributionSubmissionStatus.Approved,
    });

  if (userId) {
    builder.andWhere('submission."userId" = :userId', { userId });
  }

  if (unpaidOnly) {
    builder.andWhere('submission."paymentId" IS NULL');
  }

  const row = await builder.getRawOne<SumRow>();

  return toContributionInt(row?.sum);
};

export const getLifetimeAmountCents = async ({
  con,
}: {
  con: EntityManager;
}): Promise<number> => {
  const row = await con
    .getRepository(ContributionPayment)
    .createQueryBuilder('payment')
    .select('COALESCE(SUM(payment."amountCents"), 0)', 'sum')
    .where('payment.status = :status', {
      status: ContributionPaymentStatus.Finalized,
    })
    .getRawOne<SumRow>();

  return toContributionInt(row?.sum);
};

const getContributionActionUsage = async ({
  con,
  userId,
  actionId,
}: {
  con: EntityManager;
  userId: string;
  actionId: string;
}): Promise<ContributionActionUsage> => {
  const row = await con
    .getRepository(ContributionSubmission)
    .createQueryBuilder('submission')
    .select('COUNT(*)', 'count')
    .addSelect('MAX(submission."createdAt")', 'latestCreatedAt')
    .where('submission."userId" = :userId', { userId })
    .andWhere('submission."actionId" = :actionId', { actionId })
    .andWhere('submission.status IN (:...statuses)', {
      statuses: ACTIVE_STATUSES_FOR_LIMITS,
    })
    .getRawOne<{
      count: string | number | null;
      latestCreatedAt: Date | string | null;
    }>();

  const latestCreatedAt = row?.latestCreatedAt
    ? new Date(row.latestCreatedAt)
    : null;

  return {
    count: toContributionInt(row?.count),
    latestCreatedAt:
      latestCreatedAt && !Number.isNaN(latestCreatedAt.getTime())
        ? latestCreatedAt
        : null,
  };
};

const normalizeEvidenceSchema = (
  evidence: ContributionEvidenceSchema,
): z.infer<typeof contributionActionEvidenceSchema> =>
  contributionActionEvidenceSchema.parse(evidence ?? {});

export const validateContributionEvidence = ({
  input,
  action,
}: {
  input: z.infer<typeof contributionSubmissionEvidenceSchema>;
  action: ContributionAction;
}): void => {
  const requiredEvidence = normalizeEvidenceSchema(action.evidence);

  if (requiredEvidence.url?.required && !input.url) {
    throw new ValidationError('URL evidence is required');
  }

  if (requiredEvidence.screenshot?.required && !input.screenshotUrl) {
    throw new ValidationError('Screenshot evidence is required');
  }

  if (requiredEvidence.note?.required && !input.note) {
    throw new ValidationError('Note evidence is required');
  }

  const allowedDomains = requiredEvidence.url?.allowedDomains;
  if (!input.url || !allowedDomains?.length) {
    return;
  }

  const hostname = new URL(input.url).hostname.toLowerCase();
  const matchesAllowedDomain = allowedDomains.some((domain) => {
    const normalizedDomain = domain.toLowerCase();

    return (
      hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`)
    );
  });

  if (!matchesAllowedDomain) {
    throw new ValidationError('URL evidence domain is not allowed');
  }
};

export const validateContributionActionLimits = async ({
  con,
  userId,
  action,
  now,
}: {
  con: EntityManager;
  userId: string;
  action: ContributionAction;
  now: Date;
}): Promise<void> => {
  const actionUsage = await getContributionActionUsage({
    con,
    userId,
    actionId: action.id,
  });

  if (
    action.maxPerUser !== null &&
    action.maxPerUser !== undefined &&
    (actionUsage?.count ?? 0) >= action.maxPerUser
  ) {
    throw new ValidationError('Action limit reached');
  }

  if (!action.cooldownSeconds || !actionUsage?.latestCreatedAt) {
    return;
  }

  const cooldownEndsAt = new Date(
    actionUsage.latestCreatedAt.getTime() + action.cooldownSeconds * 1000,
  );

  if (cooldownEndsAt > now) {
    throw new ValidationError('Action is still cooling down');
  }
};
