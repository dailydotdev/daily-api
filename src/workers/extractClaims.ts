import {
  ClaimChangeType as ProtoClaimChangeType,
  ClaimDirectness as ProtoClaimDirectness,
  ClaimEntityKind as ProtoClaimEntityKind,
  ContentFormat,
} from '@dailydotdev/schema';
import type { TypedWorker } from './worker';
import { ClaimChangeType } from '../entity/claim/Claim';
import {
  ClaimCandidate,
  ClaimDirectness,
} from '../entity/claim/ClaimCandidate';
import { LedgerEntityKind } from '../entity/claim/LedgerEntity';
import { Source } from '../entity/Source';
import { downloadTextFromUri } from '../common/googleCloud';
import { getBragiClient } from '../integrations/bragi/clients';

const changeTypeMap: Record<number, ClaimChangeType> = {
  [ProtoClaimChangeType.BREAKING]: ClaimChangeType.Breaking,
  [ProtoClaimChangeType.DEPRECATION]: ClaimChangeType.Deprecation,
  [ProtoClaimChangeType.REMOVAL]: ClaimChangeType.Removal,
  [ProtoClaimChangeType.RELEASE]: ClaimChangeType.Release,
  [ProtoClaimChangeType.NEW_CAPABILITY]: ClaimChangeType.NewCapability,
  [ProtoClaimChangeType.DISPLACEMENT]: ClaimChangeType.Displacement,
  [ProtoClaimChangeType.CONSENSUS_SHIFT]: ClaimChangeType.ConsensusShift,
  [ProtoClaimChangeType.GOTCHA]: ClaimChangeType.Gotcha,
  [ProtoClaimChangeType.SECURITY]: ClaimChangeType.Security,
};

const entityKindMap: Record<number, LedgerEntityKind> = {
  [ProtoClaimEntityKind.PACKAGE]: LedgerEntityKind.Package,
  [ProtoClaimEntityKind.MODEL]: LedgerEntityKind.Model,
  [ProtoClaimEntityKind.API]: LedgerEntityKind.Api,
  [ProtoClaimEntityKind.SPEC]: LedgerEntityKind.Spec,
  [ProtoClaimEntityKind.SERVICE]: LedgerEntityKind.Service,
  [ProtoClaimEntityKind.TOOL]: LedgerEntityKind.Tool,
  [ProtoClaimEntityKind.RUNTIME]: LedgerEntityKind.Runtime,
  [ProtoClaimEntityKind.OTHER]: LedgerEntityKind.Other,
};

const directnessMap: Record<number, ClaimDirectness> = {
  [ProtoClaimDirectness.ANNOUNCEMENT]: ClaimDirectness.Announcement,
  [ProtoClaimDirectness.REPORT]: ClaimDirectness.Report,
  [ProtoClaimDirectness.FIRSTHAND]: ClaimDirectness.Firsthand,
};

// Bragi emits YYYY-MM or YYYY-MM-DD, and "" when the post does not state it.
const toDateColumn = (value: string): string | null => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : null;
};

const worker: TypedWorker<'yggdrasil.v1.content-published'> = {
  subscription: 'api.content-published-extract-claims',
  handler: async ({ data, messageId }, con, logger): Promise<void> => {
    // Absent until yggdrasil maps bragi's triage fields onto the payload.
    if (data.meta?.change_signal !== 'clear') {
      return;
    }

    const postId = data.post_id;
    const resourceLocation = data.meta?.cleaned?.[0]?.resource_location;

    if (!postId || !resourceLocation?.startsWith('gs://')) {
      return;
    }

    const logDetails = { postId, messageId };

    try {
      // Passed to bragi verbatim: evidence spans must match the post exactly.
      const content = await downloadTextFromUri(resourceLocation);

      if (!content) {
        return;
      }

      const source = data.source_id
        ? await con
            .getRepository(Source)
            .findOne({ select: ['name'], where: { id: data.source_id } })
        : null;
      const publishedAt = data.published_at
        ? new Date(data.published_at)
        : new Date();

      const bragiClient = getBragiClient();
      const response = await bragiClient.garmr.execute(() =>
        bragiClient.instance.extractClaims({
          postId,
          title: data.title ?? '',
          contentFormat: ContentFormat.XML,
          content,
          url: data.url,
          source: source?.name ?? data.source_id ?? '',
          publishedDate: publishedAt.toISOString().slice(0, 10),
        }),
      );

      const candidates = response.claims.reduce<Partial<ClaimCandidate>[]>(
        (acc, claim) => {
          const changeType = changeTypeMap[claim.changeType];

          if (!changeType || !claim.entityName || !claim.statement) {
            return acc;
          }

          acc.push({
            postId,
            rawEntityName: claim.entityName,
            entityAliases: claim.entityAliases,
            entityKind:
              entityKindMap[claim.entityKind] ?? LedgerEntityKind.Other,
            changeType,
            statement: claim.statement,
            versionScope: claim.versionScope || null,
            effectiveDate: toDateColumn(claim.effectiveDate),
            sunsetDate: toDateColumn(claim.sunsetDate),
            supersededBy: claim.supersededBy || null,
            directness:
              directnessMap[claim.directness] ?? ClaimDirectness.Report,
            evidence: claim.evidence,
          });

          return acc;
        },
        [],
      );

      if (!candidates.length) {
        return;
      }

      await con.transaction((manager) =>
        manager.getRepository(ClaimCandidate).insert(candidates),
      );
    } catch (err) {
      logger.error({ ...logDetails, err }, 'Failed to extract claims');
      throw err;
    }
  },
};

export default worker;
