import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import { In, type EntityManager } from 'typeorm';
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
import { ContributionPaymentAllocation } from '../../entity/contribution/ContributionPaymentAllocation';
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

type ContributionActionEvidenceInput = z.infer<
  typeof contributionActionEvidenceSchema
>;

type ContributionPointAllocation = {
  userId: string;
  points: number;
  amountCents: number;
};

type ContributionPaymentAllocationInput = Pick<
  ContributionPaymentAllocation,
  'paymentId' | 'userId' | 'causeId' | 'points' | 'amountCents'
>;

type ContributionPaymentUserAllocation = {
  userId: string;
  points: number;
  causeIds: string[];
};

type ContributionPaymentFinalizationError =
  | 'noSubmissions'
  | 'noActiveCauses'
  | 'noPoints';

type ContributionPaymentFinalizationResult =
  | {
      payment: ContributionPayment;
    }
  | {
      error: ContributionPaymentFinalizationError;
    };

type ContributionPaymentSnapshotRow = {
  submissionIds: string[] | null;
  totalPoints: string | number | null;
  activeCauseIds: string[] | null;
  userAllocations: ContributionPaymentUserAllocation[] | string | null;
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

const splitContributionInteger = ({
  total,
  parts,
}: {
  total: number;
  parts: number;
}): number[] => {
  const base = Math.floor(total / parts);
  const remainder = total % parts;

  return Array.from(
    { length: parts },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
};

const allocateContributionAmountByPoints = ({
  userPoints,
  amountCents,
  totalPoints,
}: {
  userPoints: Map<string, number>;
  amountCents: number;
  totalPoints: number;
}): ContributionPointAllocation[] => {
  const allocations = [...userPoints.entries()]
    .sort(([firstUserId], [secondUserId]) =>
      firstUserId.localeCompare(secondUserId),
    )
    .map(([userId, points]) => ({
      userId,
      points,
      amountCents: Math.floor((amountCents * points) / totalPoints),
      remainder: (amountCents * points) % totalPoints,
    }));

  const allocatedAmountCents = allocations.reduce(
    (total, allocation) => total + allocation.amountCents,
    0,
  );
  const remainderCents = amountCents - allocatedAmountCents;
  const remainderOrder = [...allocations].sort((first, second) => {
    if (second.remainder !== first.remainder) {
      return second.remainder - first.remainder;
    }

    return first.userId.localeCompare(second.userId);
  });

  for (let index = 0; index < remainderCents; index += 1) {
    remainderOrder[index].amountCents += 1;
  }

  return allocations.map(({ userId, points, amountCents }) => ({
    userId,
    points,
    amountCents,
  }));
};

const getContributionPaymentAllocations = ({
  paymentId,
  userAllocations,
  amountCents,
  totalPoints,
}: {
  paymentId: string;
  userAllocations: ContributionPaymentUserAllocation[];
  amountCents: number;
  totalPoints: number;
}): ContributionPaymentAllocationInput[] => {
  const userAllocationById = new Map(
    userAllocations.map((allocation) => [allocation.userId, allocation]),
  );

  return allocateContributionAmountByPoints({
    userPoints: new Map(
      userAllocations.map((allocation) => [
        allocation.userId,
        allocation.points,
      ]),
    ),
    amountCents,
    totalPoints,
  })
    .flatMap((weightedAllocation) => {
      const allocation = userAllocationById.get(weightedAllocation.userId);
      const causeIds = allocation?.causeIds ?? [];
      const pointParts = splitContributionInteger({
        total: weightedAllocation.points,
        parts: causeIds.length,
      });
      const amountParts = splitContributionInteger({
        total: weightedAllocation.amountCents,
        parts: causeIds.length,
      });

      return causeIds.map((causeId, index) => ({
        paymentId,
        userId: weightedAllocation.userId,
        causeId,
        points: pointParts[index],
        amountCents: amountParts[index],
      }));
    })
    .filter(
      (allocation) => allocation.points > 0 || allocation.amountCents > 0,
    );
};

const parseContributionUserAllocations = (
  value: ContributionPaymentSnapshotRow['userAllocations'],
): ContributionPaymentUserAllocation[] => {
  if (!value) {
    return [];
  }

  const parsed = typeof value === 'string' ? JSON.parse(value) : value;

  return parsed.map(
    ({
      userId,
      points,
      causeIds,
    }: {
      userId: string;
      points: string | number;
      causeIds: string[] | null;
    }) => ({
      userId,
      points: toContributionInt(points),
      causeIds: causeIds ?? [],
    }),
  );
};

export const finalizeContributionPayment = async ({
  con,
  amountCents,
  createdBy,
}: {
  con: EntityManager;
  amountCents: number;
  createdBy?: string | null;
}): Promise<ContributionPaymentFinalizationResult> => {
  const snapshot = await con
    .createQueryBuilder()
    .addCommonTableExpression(
      `
        SELECT
          submission.id,
          submission."userId",
          submission."awardedPoints"
        FROM "contribution_submission" submission
        WHERE submission.status = :status
          AND submission."paymentId" IS NULL
        ORDER BY submission."createdAt" ASC, submission.id ASC
        FOR UPDATE
      `,
      'locked_submission',
    )
    .addCommonTableExpression(
      `
        SELECT
          cause.id
        FROM "contribution_cause" cause
        WHERE cause.active = true
      `,
      'active_cause',
    )
    .addCommonTableExpression(
      `
        SELECT
          locked_submission."userId",
          SUM(locked_submission."awardedPoints")::int AS points
        FROM locked_submission
        GROUP BY locked_submission."userId"
      `,
      'user_points',
    )
    .addCommonTableExpression(
      `
        SELECT
          preference."userId",
          array_agg(preference."causeId" ORDER BY preference."causeId") AS "causeIds"
        FROM "user_contribution_cause_preference" preference
        INNER JOIN active_cause
          ON active_cause.id = preference."causeId"
        GROUP BY preference."userId"
      `,
      'preferred_cause',
    )
    .select(
      'COALESCE((SELECT array_agg(id) FROM locked_submission), ARRAY[]::uuid[])',
      'submissionIds',
    )
    .addSelect(
      'COALESCE((SELECT SUM("awardedPoints") FROM locked_submission), 0)::int',
      'totalPoints',
    )
    .addSelect(
      'COALESCE((SELECT array_agg(id ORDER BY id) FROM active_cause), ARRAY[]::uuid[])',
      'activeCauseIds',
    )
    .addSelect(
      `
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'userId', user_points."userId",
              'points', user_points.points,
              'causeIds', COALESCE(
                preferred_cause."causeIds",
                (SELECT array_agg(id ORDER BY id) FROM active_cause)
              )
            )
            ORDER BY user_points."userId"
          )
          FROM user_points
          LEFT JOIN preferred_cause
            ON preferred_cause."userId" = user_points."userId"
        ), '[]'::jsonb)
      `,
      'userAllocations',
    )
    .from('(SELECT 1)', 'snapshot')
    .setParameter('status', ContributionSubmissionStatus.Approved)
    .getRawOne<ContributionPaymentSnapshotRow>();
  const submissionIds = snapshot?.submissionIds ?? [];

  if (!submissionIds.length) {
    return { error: 'noSubmissions' };
  }

  const totalPoints = toContributionInt(snapshot?.totalPoints);

  if (totalPoints <= 0) {
    return { error: 'noPoints' };
  }

  if (!snapshot?.activeCauseIds?.length) {
    return { error: 'noActiveCauses' };
  }

  const userAllocations = parseContributionUserAllocations(
    snapshot.userAllocations,
  );
  const payment = await con.getRepository(ContributionPayment).save({
    status: ContributionPaymentStatus.Finalized,
    totalPoints,
    amountCents,
    createdBy,
    finalizedAt: new Date(),
  });
  const paymentAllocations = getContributionPaymentAllocations({
    paymentId: payment.id,
    userAllocations,
    amountCents,
    totalPoints,
  });

  await con.getRepository(ContributionPaymentAllocation).insert(
    paymentAllocations.map((allocation) => ({
      paymentId: allocation.paymentId,
      userId: allocation.userId,
      causeId: allocation.causeId,
      points: allocation.points,
      amountCents: allocation.amountCents,
    })),
  );
  await con.getRepository(ContributionSubmission).update(
    {
      id: In(submissionIds),
    },
    {
      paymentId: payment.id,
    },
  );

  return { payment };
};

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

export const normalizeContributionActionEvidence = (
  evidence:
    | ContributionActionEvidenceInput
    | ContributionEvidenceSchema
    | null
    | undefined,
): ContributionEvidenceSchema => {
  const parsed = contributionActionEvidenceSchema.parse(evidence ?? {});

  return {
    ...(parsed.url
      ? {
          url: {
            ...(parsed.url.required !== undefined &&
            parsed.url.required !== null
              ? { required: parsed.url.required }
              : {}),
            ...(parsed.url.allowedDomains
              ? { allowedDomains: parsed.url.allowedDomains }
              : {}),
          },
        }
      : {}),
    ...(parsed.screenshot
      ? {
          screenshot: {
            ...(parsed.screenshot.required !== undefined &&
            parsed.screenshot.required !== null
              ? { required: parsed.screenshot.required }
              : {}),
          },
        }
      : {}),
    ...(parsed.note
      ? {
          note: {
            ...(parsed.note.required !== undefined &&
            parsed.note.required !== null
              ? { required: parsed.note.required }
              : {}),
          },
        }
      : {}),
  };
};

export const validateContributionEvidence = ({
  input,
  action,
}: {
  input: z.infer<typeof contributionSubmissionEvidenceSchema>;
  action: ContributionAction;
}): void => {
  const requiredEvidence = normalizeContributionActionEvidence(action.evidence);

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
