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
import { PostType } from '../entity/posts/Post';
import { Source } from '../entity/Source';
import { downloadTextFromUri } from '../common/googleCloud';
import {
  isTwitterSocialType,
  mapTwitterSocialPayload,
} from '../common/twitterSocial';
import { getBragiClient } from '../integrations/bragi/clients';
import type { Data } from './postUpdated/types';

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
  [ProtoClaimChangeType.FIX]: ClaimChangeType.Fix,
  [ProtoClaimChangeType.PRICING]: ClaimChangeType.Pricing,
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

// Only articles are cleaned into XML, so requiring one dropped every other type
// the triage flagged — which is what kept the ledger article-only for its first
// year. The rest still have text, just somewhere else: YouTube captions are
// scraped into their own GCS bucket as plain text, while tweets and collections
// carry theirs on the payload. Freeform is deliberately excluded: squad posts
// can be private, and the ledger has no privacy model yet.
const inlineTextTypes: string[] = [PostType.SocialTwitter, PostType.Collection];

const resolveInlineText = (
  data: Data,
): { title: string; content: string } | null => {
  if (!inlineTextTypes.includes(data.content_type ?? '')) {
    return null;
  }

  if (!isTwitterSocialType(data.content_type)) {
    const content = data.extra?.content?.trim();

    return content ? { title: data.title ?? '', content } : null;
  }

  try {
    // A thread keeps its root tweet in the title and the rest in content, so
    // the shared mapper is the only place that reassembles the whole text.
    const { fields } = mapTwitterSocialPayload({ data });
    const content = fields.content?.trim() || fields.title?.trim();

    return content ? { title: fields.title ?? '', content } : null;
  } catch {
    // postUpdated maps the same payload and fails loudly on it, so a malformed
    // tweet has no post to attach claims to either way.
    return null;
  }
};

type ContentSource = {
  uri: string | null;
  content: string | null;
  title: string;
  contentFormat: ContentFormat;
};

const resolveContentSource = (data: Data): ContentSource | null => {
  const cleaned = data.meta?.cleaned?.[0]?.resource_location;

  if (cleaned?.startsWith('gs://')) {
    return {
      uri: cleaned,
      content: null,
      title: data.title ?? '',
      contentFormat: ContentFormat.XML,
    };
  }

  // Only for video: the article scrape under the same key is raw page HTML,
  // which bragi would have to clean again — the cleaned XML above is better.
  const scraped = data.meta?.scraped?.resource_location;

  if (
    data.content_type === PostType.VideoYouTube &&
    scraped?.startsWith('gs://')
  ) {
    return {
      uri: scraped,
      content: null,
      title: data.title ?? '',
      contentFormat: ContentFormat.Markdown,
    };
  }

  const inline = resolveInlineText(data);

  return inline
    ? { uri: null, ...inline, contentFormat: ContentFormat.Markdown }
    : null;
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
    const contentSource = resolveContentSource(data);

    if (!postId || !contentSource) {
      return;
    }

    // The topic fires on updates too — yggdrasil republishes a post on caption
    // merges and re-enrichment — and Pub/Sub can redeliver, so extracting on
    // every message piles up semantic duplicates for the same post. Extraction
    // is therefore frozen at first sight of a post; re-extracting after the
    // content changes is an explicit operation over the private ledger routes,
    // not an implicit side effect of the topic. Checked before the GCS fetch so
    // repeat deliveries cost nothing. Reads the primary: a replica lag here
    // would let a redelivery slip through.
    if (await con.getRepository(ClaimCandidate).existsBy({ postId })) {
      return;
    }

    const logDetails = { postId, messageId };

    try {
      // Passed to bragi verbatim: evidence spans must match the post exactly.
      const content = contentSource.uri
        ? await downloadTextFromUri(contentSource.uri)
        : contentSource.content;

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
          title: contentSource.title,
          contentFormat: contentSource.contentFormat,
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
