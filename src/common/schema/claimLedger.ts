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
const note = z.string().trim().min(1).max(500);
const description = z.string().trim().min(1).max(1000);
// Symbols, import paths, model IDs and endpoints, kept as the literal token a
// plan would carry so matching stays an equality check.
const signatures = z.array(z.string().trim().min(1).max(200)).max(50);

const commaSeparated = z
  .union([z.string(), z.array(z.string())])
  .transform((value) =>
    (Array.isArray(value) ? value : value.split(','))
      .map((item) => item.trim())
      .filter(Boolean),
  );

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
  'affected',
  'superseding',
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
    affected: signatures.optional(),
    superseding: signatures.optional(),
    // A post can state several facts at once, so a candidate already merged
    // splits into a second claim, but only when the reviewer asks for it.
    split: z.boolean().optional(),
    // A policy ruling can retroactively legitimize a denied candidate, so a
    // denial is reopened only through an explicit exception.
    revive: z.boolean().optional(),
    // The rule the decision cites, kept on the candidate so the reasoning
    // outlives the reviewer's scratch file.
    note: note.optional(),
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
  )
  .refine(
    ({ split, action, claimId, statement }) =>
      !split ||
      (action === 'merge' && !claimId && typeof statement !== 'undefined'),
    {
      error: 'split requires merging into a new claim with a statement',
      path: ['split'],
    },
  )
  .refine(({ revive, action }) => !revive || action === 'merge', {
    error: 'revive is only valid when merging',
    path: ['revive'],
  });

export const ledgerEntityQuerySchema = z.strictObject({
  name: entityName,
});

// The describe backlog. An entity nothing else points at and that carries one
// claim is not reachable by describing an approach — nobody plans "I need to
// parse argv" and means one particular package — so it stays out of the queue
// rather than spending a description that could only ever be noise.
export const ledgerEntityUndescribedSchema = z.strictObject({
  minClaims: z.coerce.number().int().min(1).max(50).default(2),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const ledgerEntityCreateSchema = z.strictObject({
  canonicalName: entityName,
  kind: z.enum(enumValues(LedgerEntityKind)),
  aliases: z.array(entityName).max(50).default([]),
  keywordValue: keywordValue.nullish(),
  parentId: z.uuid().nullish(),
  description: description.nullish(),
});

// Aliases keep their own route, so a rename never has to restate them.
export const ledgerEntityUpdateSchema = z.strictObject({
  entityId: z.uuid(),
  canonicalName: entityName.optional(),
  kind: z.enum(enumValues(LedgerEntityKind)).optional(),
  keywordValue: keywordValue.nullish(),
  parentId: z.uuid().nullish(),
  description: description.nullish(),
});

// A plan describes an approach without naming what implements it, so discovery
// takes the prose and answers with entities to check, never with findings: the
// nearest neighbour is a candidate, and the claim rows decide.
export const ledgerEntityDiscoverSchema = z.strictObject({
  text: z.string().trim().min(1).max(2000),
  limit: z.coerce.number().int().positive().max(25).default(10),
  // A floor against garbage only. Measured on the retrieval this exists for,
  // an unrelated entity scores ~0.27 and a correct one ~0.32-0.48, so no single
  // cutoff separates them: rank carries the signal and the claims filed against
  // the candidates settle it, which is why nothing here decides on the score.
  minSimilarity: z.coerce.number().min(0).max(1).default(0.2),
});

export const ledgerEntityAliasSchema = z.strictObject({
  entityId: z.uuid(),
  alias: entityName,
});

// Extraction files the same artifact twice under names that only later turn out
// to be the same thing, so the duplicate is folded into the entity that keeps it.
export const ledgerEntityMergeSchema = z
  .strictObject({
    fromEntityId: z.uuid(),
    intoEntityId: z.uuid(),
  })
  .refine(({ fromEntityId, intoEntityId }) => fromEntityId !== intoEntityId, {
    error: 'A ledger entity cannot be merged into itself',
    path: ['intoEntityId'],
  });

// Stray entities extraction probed into existence carry nothing, and merging
// them into a neighbour would leave their names behind as its aliases.
export const ledgerEntityDeleteSchema = z.strictObject({
  entityId: z.uuid(),
});

// Corroborated demotes back to candidate when a reviewer finds the second
// source was the first one restated.
export const claimStatusUpdateSchema = z.strictObject({
  claimId: z.uuid(),
  status: z.literal([
    ClaimStatus.Candidate,
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
  affected: signatures.optional(),
  superseding: signatures.optional(),
});

// A claim filed against the wrong entity is otherwise stuck there: the entity
// it belongs to is fixed at creation and nothing else can repoint it.
export const claimMoveSchema = z.strictObject({
  claimId: z.uuid(),
  entityId: z.uuid(),
});

// Concurrent review files the same fact twice, so the duplicate is absorbed
// into the claim that keeps it instead of being rejected with its evidence.
export const claimMergeSchema = z
  .strictObject({
    fromClaimId: z.uuid(),
    intoClaimId: z.uuid(),
  })
  .refine(({ fromClaimId, intoClaimId }) => fromClaimId !== intoClaimId, {
    error: 'A claim cannot be merged into itself',
    path: ['intoClaimId'],
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

// Evidence that turns out to say nothing about the claim leaves it looking
// corroborated, so the row is removed rather than reclassified.
export const claimEvidenceDeleteSchema = z.strictObject({
  claimId: z.uuid(),
  url: z.url(),
});

// Validating a claimId is a lookup, not a feed read, so ids answers with
// exactly the claims asked for and the entity window steps aside.
export const claimsQuerySchema = z
  .strictObject({
    entities: commaSeparated
      .pipe(z.array(entityName).min(1).max(50))
      .optional(),
    ids: commaSeparated.pipe(z.array(z.uuid()).min(1).max(100)).optional(),
    since: z.iso.date().optional(),
    // Undated claims answer the window too, since a missing date hides a change
    // rather than placing it. A study slicing months wants only the dated ones.
    dated: z.stringbool().default(false),
    minStatus: z
      .literal([
        ClaimStatus.Candidate,
        ClaimStatus.Corroborated,
        ClaimStatus.Verified,
      ])
      .default(ClaimStatus.Candidate),
  })
  .refine(({ ids, entities, since }) => !!ids || (!!entities && !!since), {
    error: 'entities and since are required without ids',
    path: ['ids'],
  });
