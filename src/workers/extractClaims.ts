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
import { isTooGenericToEmit } from '../common/signatureSpecificity';
import {
  isEntityPhrase,
  loadProseEntityNames,
} from '../common/ledgerEntityNames';
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
    // would let a redelivery slip through. Selects the statements rather than a
    // bare existence flag so the same read also seeds the dedupe below.
    const filed = await con
      .getRepository(ClaimCandidate)
      .createQueryBuilder('cc')
      .select('cc.statement', 'statement')
      .where('cc."postId" = :postId', { postId })
      .getRawMany<{ statement: string }>();

    if (filed.length) {
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

      // Bragi states one fact twice often enough that unfiltered inserts hand
      // reviewers the same candidate twice, so a statement already filed for
      // the post, or already taken from this response, files nothing.
      const statements = new Set(
        filed.map(({ statement }) => statement.trim()),
      );

      // Cached for an hour, so this is one query per process rather than one
      // per post.
      const proseEntityNames = await loadProseEntityNames(con);
      const usableSignature = (token: string): boolean =>
        !isTooGenericToEmit(token) && !isEntityPhrase(token, proseEntityNames);

      const candidates = response.claims.reduce<Partial<ClaimCandidate>[]>(
        (acc, claim) => {
          const changeType = changeTypeMap[claim.changeType];
          const statement = claim.statement.trim();

          if (
            !changeType ||
            !claim.entityName ||
            !statement ||
            statements.has(statement)
          ) {
            return acc;
          }

          statements.add(statement);
          acc.push({
            postId,
            rawEntityName: claim.entityName,
            entityAliases: claim.entityAliases,
            entityKind:
              entityKindMap[claim.entityKind] ?? LedgerEntityKind.Other,
            changeType,
            statement,
            versionScope: claim.versionScope || null,
            effectiveDate: toDateColumn(claim.effectiveDate),
            sunsetDate: toDateColumn(claim.sunsetDate),
            supersededBy: claim.supersededBy || null,
            directness:
              directnessMap[claim.directness] ?? ClaimDirectness.Report,
            evidence: claim.evidence,
            // The specificity bar (smith-brain/docs/claim-ledger-review-
            // playbook.md §13, v5.9): signatures are matched by exact equality,
            // so a generic token ("name", "GET") accuses every codebase on
            // earth. Enforced here rather than in bragi so every write path
            // shares one rule with the statement backfill.
            affected: claim.affected.filter(usableSignature),
            superseding: claim.superseding.filter(usableSignature),
          });

          return acc;
        },
        [],
      );

      if (!candidates.length) {
        return;
      }

      // The check above happens a whole extraction before the write, so two
      // deliveries of the same post can both find the ledger empty, spend a
      // minute in bragi and file the same claims twice — which production did.
      // Reading again here shrinks that window to the gap between these two
      // statements, and the partial unique index behind the insert closes the
      // rest: a bare ON CONFLICT DO NOTHING drops whichever run loses.
      const raced = await con
        .getRepository(ClaimCandidate)
        .createQueryBuilder('cc')
        .select('cc.id', 'id')
        .where('cc."postId" = :postId', { postId })
        .limit(1)
        .getRawOne<{ id: string }>();

      if (raced) {
        logger.debug(logDetails, 'Claims filed by a concurrent extraction');
        return;
      }

      await con
        .createQueryBuilder()
        .insert()
        .into(ClaimCandidate)
        .values(candidates)
        .orIgnore()
        .execute();
    } catch (err) {
      logger.error({ ...logDetails, err }, 'Failed to extract claims');
      throw err;
    }
  },
};

export default worker;
