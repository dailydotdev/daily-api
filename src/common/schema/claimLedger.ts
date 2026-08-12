import z from 'zod';
import { ClaimStatus } from '../../entity/claim/Claim';
import { ClaimCandidateStatus } from '../../entity/claim/ClaimCandidate';
import { LedgerEntityKind } from '../../entity/claim/LedgerEntity';
import { ClaimEvidenceSourceClass } from '../../entity/claim/ClaimEvidence';
import { enumValues } from './utils';

const entityName = z.string().trim().min(1).max(200);

export const claimCandidateListSchema = z.object({
  status: z
    .enum(enumValues(ClaimCandidateStatus))
    .default(ClaimCandidateStatus.Pending),
  entityName: entityName.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const claimCandidateResolveSchema = z
  .object({
    candidateId: z.uuid(),
    action: z.literal(['merge', 'deny']),
    claimId: z.uuid().nullish(),
    sourceClass: z
      .enum(enumValues(ClaimEvidenceSourceClass))
      .default(ClaimEvidenceSourceClass.Community),
    url: z.url().nullish(),
  })
  .refine(({ action, claimId }) => action === 'merge' || !claimId, {
    error: 'claimId is only valid when merging',
    path: ['claimId'],
  });

export const ledgerEntityCreateSchema = z.object({
  canonicalName: entityName,
  kind: z.enum(enumValues(LedgerEntityKind)),
  aliases: z.array(entityName).max(50).default([]),
  keywordValue: z.string().trim().min(1).max(200).nullish(),
  parentId: z.uuid().nullish(),
});

export const ledgerEntityAliasSchema = z.object({
  entityId: z.uuid(),
  alias: entityName,
});

export const claimStatusUpdateSchema = z.object({
  claimId: z.uuid(),
  status: z.literal([
    ClaimStatus.Corroborated,
    ClaimStatus.Verified,
    ClaimStatus.Rejected,
  ]),
});

export const claimsQuerySchema = z.object({
  entities: z
    .union([z.string(), z.array(z.string())])
    .transform((value) =>
      (Array.isArray(value) ? value : value.split(','))
        .map((name) => name.trim())
        .filter(Boolean),
    )
    .pipe(z.array(entityName).min(1).max(50)),
  since: z.iso.date(),
  minStatus: z
    .literal([
      ClaimStatus.Candidate,
      ClaimStatus.Corroborated,
      ClaimStatus.Verified,
    ])
    .default(ClaimStatus.Candidate),
});
