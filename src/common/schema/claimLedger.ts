import z from 'zod';
import { ClaimChangeType, ClaimStatus } from '../../entity/claim/Claim';
import { ClaimCandidateStatus } from '../../entity/claim/ClaimCandidate';
import { LedgerEntityKind } from '../../entity/claim/LedgerEntity';
import { ClaimEvidenceSourceClass } from '../../entity/claim/ClaimEvidence';
import { enumValues } from './utils';

const entityName = z.string().trim().min(1).max(200);
const keywordValue = z.string().trim().min(1).max(200);
const statement = z.string().trim().min(1).max(1000);
const versionScope = z.string().trim().min(1).max(200);

export const claimCandidateListSchema = z.strictObject({
  status: z
    .enum(enumValues(ClaimCandidateStatus))
    .default(ClaimCandidateStatus.Pending),
  entityName: entityName.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const claimOverrideKeys = [
  'changeType',
  'statement',
  'versionScope',
  'effectiveDate',
  'sunsetDate',
  'entityId',
] as const;

export const claimCandidateResolveSchema = z
  .strictObject({
    candidateId: z.uuid(),
    action: z.literal(['merge', 'deny']),
    claimId: z.uuid().nullish(),
    sourceClass: z
      .enum(enumValues(ClaimEvidenceSourceClass))
      .default(ClaimEvidenceSourceClass.Community),
    url: z.url().nullish(),
    changeType: z.enum(enumValues(ClaimChangeType)).optional(),
    statement: statement.optional(),
    versionScope: versionScope.nullish(),
    effectiveDate: z.iso.date().nullish(),
    sunsetDate: z.iso.date().nullish(),
    entityId: z.uuid().optional(),
  })
  .refine(({ action, claimId }) => action === 'merge' || !claimId, {
    error: 'claimId is only valid when merging',
    path: ['claimId'],
  })
  .refine(
    (body) =>
      (body.action === 'merge' && !body.claimId) ||
      claimOverrideKeys.every((key) => typeof body[key] === 'undefined'),
    {
      error: 'Overrides are only valid when merging into a new claim',
      path: ['claimId'],
    },
  );

export const ledgerEntityQuerySchema = z.strictObject({
  name: entityName,
});

export const ledgerEntityCreateSchema = z.strictObject({
  canonicalName: entityName,
  kind: z.enum(enumValues(LedgerEntityKind)),
  aliases: z.array(entityName).max(50).default([]),
  keywordValue: keywordValue.nullish(),
  parentId: z.uuid().nullish(),
});

// Aliases keep their own route, so a rename never has to restate them.
export const ledgerEntityUpdateSchema = z.strictObject({
  entityId: z.uuid(),
  canonicalName: entityName.optional(),
  kind: z.enum(enumValues(LedgerEntityKind)).optional(),
  keywordValue: keywordValue.nullish(),
  parentId: z.uuid().nullish(),
});

export const ledgerEntityAliasSchema = z.strictObject({
  entityId: z.uuid(),
  alias: entityName,
});

export const claimStatusUpdateSchema = z.strictObject({
  claimId: z.uuid(),
  status: z.literal([
    ClaimStatus.Corroborated,
    ClaimStatus.Verified,
    ClaimStatus.Rejected,
  ]),
});

// A merged claim still moves: a date the vendor later revises, a fact a newer
// claim reverses. Only the fields sent change, and a null clears a nullable one.
export const claimUpdateSchema = z.strictObject({
  claimId: z.uuid(),
  changeType: z.enum(enumValues(ClaimChangeType)).optional(),
  statement: statement.optional(),
  versionScope: versionScope.nullish(),
  effectiveDate: z.iso.date().nullish(),
  sunsetDate: z.iso.date().nullish(),
  supersededByEntityId: z.uuid().nullish(),
  supersededByClaimId: z.uuid().nullish(),
});

// Evidence a reviewer found outside the feed, so it carries no post.
export const claimEvidenceCreateSchema = z.strictObject({
  claimId: z.uuid(),
  url: z.url(),
  sourceClass: z.enum(enumValues(ClaimEvidenceSourceClass)),
  publishedAt: z.coerce.date().nullish(),
});

// A crawled vendor post enters as community evidence, so verifying it is the
// primary source reclassifies the row the claim already cites.
export const claimEvidenceUpdateSchema = z.strictObject({
  claimId: z.uuid(),
  url: z.url(),
  sourceClass: z.enum(enumValues(ClaimEvidenceSourceClass)),
});

export const claimsQuerySchema = z.strictObject({
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
