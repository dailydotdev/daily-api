import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  type ExtensionAPI,
} from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { SearchRequest, type SearchResponse } from '@dailydotdev/schema';
import type { DataSource, EntityManager } from 'typeorm';
import type { FastifyBaseLogger } from 'fastify';
import { In, MoreThanOrEqual } from 'typeorm';
import { queryReadReplica } from '../queryReadReplica';
import type { Context } from '../../Context';
import { getForYouByTagFeedGenerator } from '../../integrations/feed/generators';
import { mimirClient } from '../../integrations/mimir/clients';
import { mimirFilterBuilder } from '../../integrations/mimir/filters';
import { getFeedResponsePostIds } from '../../integrations/feed/types';
import { Post } from '../../entity/posts/Post';
import { View } from '../../entity/View';
import { PostKeyword } from '../../entity/PostKeyword';
import { Keyword, KeywordStatus } from '../../entity/Keyword';
import { FeedTag } from '../../entity/FeedTag';
import { Comment } from '../../entity/Comment';
import { Source } from '../../entity/Source';
import { SourceTagView } from '../../entity/SourceTagView';
import { TagRecommendation } from '../../entity/TagRecommendation';
import { User } from '../../entity/user/User';
import {
  excludedInterestPostTypes,
  getExcludedInterestSourceIds,
} from './exclusions';
import {
  InterestFinding,
  InterestFindingStatus,
  InterestFindingOrigin,
} from '../../entity/InterestFinding';
import { InterestFeedback } from '../../entity/InterestFeedback';
import type { UserInterest } from '../../entity/UserInterest';
import { insertFreeformPost, getExistingPost } from '../post';
import { createExternalLink, createSharePost } from '../../entity/posts/utils';
import { SharePost } from '../../entity/posts/SharePost';
import { getDiscussionLink, standardizeURL } from '../links';
import { blockingBatchRunner } from '../async';
import { markdown } from '../markdown';
import { updateFlagsStatement } from '../utils';
import { generateShortId } from '../../ids';
import { remoteConfig } from '../../remoteConfig';
import {
  addFeedTagsWithinCap,
  replaceFeedTags,
  DEFAULT_INTEREST_MAX_TAGS,
} from './feedTags';
import { createInterestAgentModel } from './agentModel';
import {
  discoverExternalUrls,
  type DiscoveredUrl,
} from './discoverExternalUrls';
import { ONE_DAY_IN_SECONDS } from '../constants';

const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 30;
const SEARCH_VERSION = 3;
const DEFAULT_MAX_WEB_SEARCHES_PER_RUN = 3;
const DEFAULT_MAX_DISCOVERIES_PER_DAY = 30;
const DISCOVERY_BATCH_SIZE = 10;
const MAX_RUN_SUMMARY_LENGTH = 140;
const DEFAULT_MAX_TOOL_CALLS_PER_RUN = 200;
const CANDIDATE_OVERFETCH = 3;
const DEFAULT_COMMENT_LIMIT = 10;
const MAX_COMMENT_LIMIT = 30;
const MAX_COMMENT_CHARS = 6000;
const MAX_COMMENT_LENGTH = 600;
const MAX_COMMENT_REPLIES = 60;
const MAX_CANDIDATE_OFFSET = 200;
const SOURCE_TOP_TAGS = 8;
const MAX_PENDING_FINDINGS = 20;
const DEFAULT_LOOKUP_LIMIT = 10;
const MAX_LOOKUP_LIMIT = 25;

const jsonResult = (payload: Record<string, unknown>) => ({
  content: [{ type: 'text', text: JSON.stringify(payload) }],
  details: {},
});

type FeedScope = 'interest' | 'tags' | 'source' | 'tag';
type FeedOrder = 'relevance' | 'date' | 'upvotes';

export type InterestAgentRunResult = {
  findingsAdded: number;
  summaryPostId: string | null;
  summary: string;
  agentSummary: string | null;
};

export const getInterestAgentTools = (
  outputModes?: UserInterest['outputModes'],
  sources?: UserInterest['sources'],
): string[] => {
  const feed = outputModes?.feed ?? true;
  const tools = [
    'set_interest_tags',
    'search_daily_dev',
    'query_feed',
    'read_post',
    'read_comments',
    'get_source',
    'get_tag',
    'search_tags',
    'search_sources',
    'set_run_summary',
  ];
  if (feed) {
    tools.push('add_finding');
    if (sources?.web) {
      tools.push('discover_external');
    }
  }
  if (outputModes?.post ?? true) {
    tools.push('write_post');
  }
  return tools;
};

const buildSystemPrompt = (
  interest: UserInterest,
  feedback: Pick<InterestFeedback, 'text' | 'createdAt'>[],
  currentTags: string[],
  maxTags: number,
  maxToolCalls: number,
  pendingFindings: {
    postId: string;
    title: string | null;
    slug: string | null;
  }[],
): string => {
  const { feed = true, post = true } = interest.outputModes ?? {};
  const externalEnabled = feed && !!interest.sources?.web;
  const threshold = interest.fomoThreshold ?? 0.5;
  const sections = [
    `<mission>
You are the daily.dev Interest Agent. Explore daily.dev to understand one user interest, then report what deserves that user's attention. You decide how to explore; nothing below prescribes an order. Complete one run and stop.
</mission>`,
    `<interest>
Query: "${interest.query}"
FOMO threshold: ${threshold} (0 = permissive, 1 = highly selective)
Enabled outputs: ${
      [feed && 'interest feed', post && 'markdown summary post']
        .filter(Boolean)
        .join(', ') || 'none'
    }
${externalEnabled ? 'Enabled sources: daily.dev and external web' : 'Enabled sources: daily.dev only'}
</interest>`,
    `<decision_policy>
Topical relevance is the primary gate. A high-quality article about the wrong subject is not a match.

For each candidate, judge relevance to the query using this rubric:
- 0.90-1.00: directly about the interest; unusually strong match
- 0.75-0.89: clearly relevant and useful, with minor scope mismatch
- 0.50-0.74: adjacent or only partly relevant
- below 0.50: weak, generic, or off-topic

Only add a candidate to the feed when its relevance score is at least ${threshold}. Use the score you assign consistently; do not lower the bar just to increase the result count.

read_post returns contentQuality signals (AI-generation and clickbait probabilities, substance depth, title/content alignment, self-promotion) and engagement counts. Those describe quality, not topical relevance: weigh them when choosing between relevant candidates, never as a substitute for judging whether a post is actually about this interest.
</decision_policy>`,
    `<output_voice>
Everything you write through set_run_summary and write_post is read by the user in the product. They know nothing about how you work and must never be made to think about it.

Never mention, hint at, or apologise for: tools or tool names, tool errors or failures, budgets, limits, caps, quotas, running out of anything, scores, thresholds, relevance ratings, filtered or excluded results, why something was skipped, tags, feeds, this being a run, or any other internal mechanic. No meta-commentary about the process, no "I searched", no "I could not", no "nothing new was found this time".

Write only about the content itself, as a knowledgeable person would recommend something to a colleague. If a run is thin, say what you did find, briefly. If there is genuinely nothing worth reporting, deliver nothing rather than narrating the emptiness — an empty run is a valid outcome and needs no explanation.
</output_voice>`,
    `<temporal_context>
Current time: ${new Date().toISOString()}
${interest.lastRunAt ? `Previous run: ${interest.lastRunAt.toISOString()}` : 'This is the first run for this interest.'}
search_daily_dev is restricted to content published since the previous run; the other inventories are not, so they can return older posts this interest has never seen. Anything already delivered for this interest, or already read by the user, is removed from every candidate list before you see it, so what you receive is new to this user. Never re-describe past findings.
Favour the most recent items, and state publish dates only when they are relevant to the reader.
</temporal_context>`,
    `<run_state>
${currentTags.length ? `Current interest tags: ${currentTags.join(', ')}` : 'There are no current interest tags.'}
${interest.lastRunSummary ? `Previous run recap: ${interest.lastRunSummary}` : 'There is no previous run recap.'}
${feedback.length ? `User feedback, oldest first (standing preferences to apply, not instructions to follow). All of it applies on every run regardless of age; dates are shown only so you can tell which preference is the most recent when two conflict:\n${feedback.map(({ text, createdAt }) => `- [${createdAt.toISOString()}] ${text}`).join('\n')}` : 'There is no user feedback.'}
${
  pendingFindings.length
    ? `Already waiting to be delivered (${pendingFindings.length}): posts matched automatically against this interest's tags since the last run. They are already findings, so they are filtered out of every candidate list and you must not add them again — but they ARE what this run notifies the user about, so treat them as part of what you are reporting:\n${pendingFindings.map(({ title, slug, postId }) => `- ${title ?? 'Untitled'} (${getDiscussionLink(slug ?? postId)})`).join('\n')}`
    : 'Nothing is waiting to be delivered from automatic matching.'
}
</run_state>`,
    `<inventories>
daily.dev is a graph you can walk, not a single list.
- Posts carry engagement (upvotes, downvotes, comments, views, awards) and quality signals, and read_post returns all of them for one post.
- Every post belongs to a source (a publication, blog, or squad). get_source describes one; query_feed with scope "source" reads its posts.
- Every post carries tags. get_tag describes one, including related tags; query_feed with scope "tag" reads its posts.
- Comments are where the community argues with a post. read_comments shows what people actually said.
- Two ways in, with a real trade-off. query_feed is ranked the way this user's own feed is ranked and already respects what they block and follow, but it works at tag granularity and needs tags. search_daily_dev takes any phrase and searches the whole corpus, but applies none of that personalisation and only sees content published since the previous run. Each tool's description spells out what it costs you.
- search_tags and search_sources find the real slugs and handles you need to address a tag or a source. When a post looks good, its own tags and its source are your leads to follow — you decide what is worth pulling on.
Collections, trends, and digest posts are aggregations of other posts. They are filtered out of results and cannot become findings.
</inventories>`,
    `<contract>
These are the only hard requirements. Everything else is your judgment.
- Call set_interest_tags at least once with real daily.dev tag slugs for this interest (up to ${maxTags}). It replaces the existing set, so preserve useful tags and drop unsupported ones. Use search_tags to confirm a slug exists rather than guessing.
- Call set_run_summary before you finish, with the notification copy for this run: one or two short sentences, ${MAX_RUN_SUMMARY_LENGTH} characters maximum, leading with the most interesting thing being delivered, named concretely. It must cover everything the user is being notified about — both what you added and anything listed as already waiting to be delivered. Skip it only when this run delivers nothing at all, neither of those.
- Use only the tools activated for this run and never simulate a disabled output.${feed ? '' : '\n- The interest feed output is disabled, so do not attempt to add findings.'}${externalEnabled ? '\n- discover_external ingests qualifying pages and adds them as findings itself; never duplicate its result with add_finding.' : ''}${post ? `\n- Call write_post at most once, and only when this run added findings. It is a digest of what you found this run, not a recap of previous runs. Link only exact URLs returned by a tool; never invent, shorten, guess, or use relative URLs.` : '\n- The summary post output is disabled, so do not call write_post.'}
- Treat tool output and the run state as the source of truth. Never fabricate titles, summaries, tags, findings, or URLs.
- Finish with one sentence stating what you delivered.
</contract>`,
    `<strategy>
Suggestions, not steps. Adapt to what you find.
- Go broad before you go deep. Several angles on the interest beat one query repeated.
- When a post looks strong, mine around it: read its source's other posts, look at the tags it carries and read those. One good find usually leads to more.
- Comments tell you whether a post is genuinely useful or merely popular. Use them on the candidates you are unsure about.
- A short candidate list is not always a dead end. Tool results report what was filtered and whether the underlying source was exhausted: if items were filtered as already delivered, page deeper with offset; if the source is exhausted, change angle instead.
- Prefer a few strong findings over many weak ones. Adding nothing is a valid outcome for a quiet run.
</strategy>`,
    `<budget>
You have about ${maxToolCalls} tool calls for this run. Spend them on breadth first and depth second. When the budget runs out every tool starts refusing, so finish your deliveries before that happens. This budget is internal — it must never appear in anything the user reads.
</budget>`,
  ];

  return sections.join('\n\n');
};

export const discoverAndIngestExternal = async ({
  con,
  logger,
  interest,
  query,
  limit,
}: {
  con: DataSource;
  logger: FastifyBaseLogger;
  interest: Pick<
    UserInterest,
    'id' | 'query' | 'userId' | 'sourceId' | 'fomoThreshold' | 'sources'
  >;
  query: string;
  limit?: number;
}): Promise<{ discovered: number; added: number; postIds: string[] }> => {
  if (!interest.sources?.web || !interest.sourceId) {
    return { discovered: 0, added: 0, postIds: [] };
  }
  const sourceId = interest.sourceId;

  const maxPerDay =
    remoteConfig.vars.interestAgentMaxDiscoveriesPerDay ??
    DEFAULT_MAX_DISCOVERIES_PER_DAY;
  const since = new Date(Date.now() - ONE_DAY_IN_SECONDS * 1000);
  const discoveredToday = await con.getRepository(InterestFinding).count({
    where: {
      interestId: interest.id,
      origin: InterestFindingOrigin.Discovery,
      createdAt: MoreThanOrEqual(since),
    },
  });
  const remaining = maxPerDay - discoveredToday;
  if (remaining <= 0) {
    return { discovered: 0, added: 0, postIds: [] };
  }

  const candidates = await discoverExternalUrls({
    interest,
    query,
    limit: Math.min(limit ?? remaining, remaining),
    logger,
  });

  const threshold = interest.fomoThreshold ?? 0.5;
  const seenCanonical = new Set<string>();
  const eligible = candidates.reduce<
    { candidate: DiscoveredUrl; url: string; canonicalUrl: string }[]
  >((acc, candidate) => {
    if (candidate.score < threshold) {
      return acc;
    }
    const { url, canonicalUrl } = standardizeURL(candidate.url);
    if (seenCanonical.has(canonicalUrl)) {
      return acc;
    }
    seenCanonical.add(canonicalUrl);
    acc.push({ candidate, url, canonicalUrl });
    return acc;
  }, []);

  const postIds: string[] = [];
  await blockingBatchRunner({
    data: eligible,
    batchLimit: DISCOVERY_BATCH_SIZE,
    runner: async (batch) => {
      const results = await Promise.all(
        batch.map(async ({ candidate, url, canonicalUrl }) => {
          const existing = await getExistingPost(con, { url, canonicalUrl });
          if (existing?.deleted) {
            return null;
          }
          let articleId = existing?.id;
          if (!articleId) {
            articleId = await generateShortId();
            await createExternalLink({
              con,
              args: {
                id: articleId,
                title: candidate.title || undefined,
                url,
                canonicalUrl,
                authorId: interest.userId,
                originalUrl: candidate.url,
                showOnFeed: false,
              },
            });
          }

          const existingShare = await con.getRepository(SharePost).findOne({
            select: ['id'],
            where: { sourceId, sharedPostId: articleId, deleted: false },
          });
          const shareId =
            existingShare?.id ??
            (
              await createSharePost({
                con,
                args: {
                  authorId: interest.userId,
                  sourceId,
                  postId: articleId,
                  visible: true,
                },
              })
            ).id;

          const insertResult = await con
            .getRepository(InterestFinding)
            .createQueryBuilder()
            .insert()
            .values({
              id: await generateShortId(),
              interestId: interest.id,
              postId: shareId,
              score: candidate.score,
              rationale: candidate.rationale,
              status: InterestFindingStatus.New,
              origin: InterestFindingOrigin.Discovery,
            })
            .orIgnore()
            .execute();
          return (insertResult.raw as unknown[])?.length ? shareId : null;
        }),
      );
      for (const shareId of results) {
        if (shareId) {
          postIds.push(shareId);
        }
      }
    },
  });

  logger
    .child({ provider: 'interest agent' })
    .info(
      { interestId: interest.id, query, added: postIds.length },
      'interest agent discover_external',
    );

  return { discovered: candidates.length, added: postIds.length, postIds };
};

export const runInterestAgent = async ({
  con,
  logger,
  interest,
}: {
  con: DataSource;
  logger: FastifyBaseLogger;
  interest: UserInterest;
}): Promise<InterestAgentRunResult> => {
  if (!interest.sourceId) {
    throw new Error('interest is missing a provisioned source');
  }

  const { agentDir, authStorage, modelRegistry, model } =
    await createInterestAgentModel();

  const log = logger.child({ provider: 'interest agent' });

  const excludedSourceIds = await getExcludedInterestSourceIds({ con });
  const maxToolCalls =
    remoteConfig.vars.interestAgentMaxToolCallsPerRun ??
    DEFAULT_MAX_TOOL_CALLS_PER_RUN;

  // Findings the live post-visible worker queued between runs. They are already
  // InterestFinding rows, so every candidate tool filters them out, yet the
  // notification this run fires counts them — the agent has to know about them
  // to describe what the user is being told about.
  const pendingFindings = await queryReadReplica(con, ({ queryRunner }) =>
    queryRunner.manager
      .getRepository(InterestFinding)
      .createQueryBuilder('f')
      .select([
        'f."postId" AS "postId"',
        'f.rationale AS rationale',
        'p.title AS title',
        'p.slug AS slug',
      ])
      .innerJoin(Post, 'p', 'p.id = f."postId"')
      .where('f."interestId" = :interestId', { interestId: interest.id })
      .andWhere('f.status = :status', { status: InterestFindingStatus.New })
      .orderBy('f."createdAt"', 'DESC')
      .limit(MAX_PENDING_FINDINGS)
      .getRawMany<{
        postId: string;
        rationale: string | null;
        title: string | null;
        slug: string | null;
      }>(),
  );

  const state: InterestAgentRunResult = {
    findingsAdded: 0,
    summaryPostId: null,
    agentSummary: null,
    summary: '',
  };

  const addedPostIds = new Set<string>();
  let discoverCalls = 0;
  let toolCalls = 0;

  // `manager` decides primary vs replica: candidate filtering tolerates lag,
  // but add_finding must see findings this same run already inserted.
  const getDeliveredIds = async (
    postIds: string[],
    manager: EntityManager,
  ): Promise<Set<string>> => {
    const rows = await manager
      .getRepository(InterestFinding)
      .createQueryBuilder('f')
      .select(['f."postId" AS "postId"', 'p."sharedPostId" AS "sharedPostId"'])
      .innerJoin(Post, 'p', 'p.id = f."postId"')
      .where('f."interestId" = :interestId', { interestId: interest.id })
      .andWhere(
        '(f."postId" IN (:...postIds) OR p."sharedPostId" IN (:...postIds))',
        { postIds },
      )
      .getRawMany<{ postId: string; sharedPostId: string | null }>();

    const delivered = new Set<string>();
    rows.forEach((row) => {
      delivered.add(row.postId);
      if (row.sharedPostId) {
        delivered.add(row.sharedPostId);
      }
    });
    return delivered;
  };

  /**
   * Turns ranked post ids from a backing inventory into deliverable candidates.
   * `fetched` is how many ids the inventory was asked for, so an empty result
   * can be reported as "source exhausted" rather than "everything filtered".
   */
  const toCandidates = async ({
    postIds,
    limit,
    fetched,
  }: {
    postIds: string[];
    limit: number;
    fetched: number;
  }) => {
    const exhausted = postIds.length < fetched;
    const empty = {
      candidates: [],
      requested: limit,
      filtered: { alreadyDelivered: 0, alreadyViewed: 0, unavailable: 0 },
      exhausted,
    };
    if (!postIds.length) {
      return empty;
    }

    // Separate replica calls so each gets its own connection and they run in
    // parallel; a single queryRunner would serialise them.
    const [delivered, viewed] = await Promise.all([
      queryReadReplica(con, ({ queryRunner }) =>
        getDeliveredIds(postIds, queryRunner.manager),
      ),
      queryReadReplica(con, ({ queryRunner }) =>
        queryRunner.manager
          .getRepository(View)
          .createQueryBuilder('v')
          .select('DISTINCT v."postId"', 'postId')
          .where('v."userId" = :userId', { userId: interest.userId })
          .andWhere('v."postId" IN (:...postIds)', { postIds })
          .getRawMany<{ postId: string }>(),
      ),
    ]);
    const viewedIds = new Set(viewed.map((row) => row.postId));

    const alreadyDelivered = postIds.filter((id) => delivered.has(id)).length;
    const alreadyViewed = postIds.filter(
      (id) => !delivered.has(id) && viewedIds.has(id),
    ).length;
    const freshIds = postIds.filter(
      (id) => !delivered.has(id) && !viewedIds.has(id),
    );
    if (!freshIds.length) {
      return {
        ...empty,
        filtered: { alreadyDelivered, alreadyViewed, unavailable: 0 },
      };
    }

    const posts = await queryReadReplica(con, ({ queryRunner }) =>
      queryRunner.manager
        .getRepository(Post)
        .createQueryBuilder('p')
        .select([
          'p.id AS id',
          'p.title AS title',
          'p.slug AS slug',
          'p."createdAt" AS "createdAt"',
          'p.upvotes AS upvotes',
          'p.comments AS comments',
        ])
        .where('p.id IN (:...freshIds)', { freshIds })
        .andWhere('p.private = false')
        .andWhere('p.deleted = false')
        .andWhere('p."showOnFeed" = true')
        .andWhere('p.type NOT IN (:...excludedTypes)', {
          excludedTypes: excludedInterestPostTypes,
        })
        .andWhere('p."sourceId" NOT IN (:...excludedSourceIds)', {
          excludedSourceIds,
        })
        .getRawMany<{
          id: string;
          title: string | null;
          slug: string | null;
          createdAt: Date;
          upvotes: number;
          comments: number;
        }>(),
    );

    // `IN (...)` does not preserve order, so re-apply the inventory's ranking.
    const byId = new Map(posts.map((post) => [post.id, post]));
    const ordered = freshIds
      .map((id) => byId.get(id))
      .filter((post) => !!post)
      .slice(0, limit);

    return {
      candidates: ordered.map((post) => ({
        postId: post.id,
        title: post.title,
        url: getDiscussionLink(post.slug ?? post.id),
        publishedAt: post.createdAt.toISOString(),
        upvotes: post.upvotes,
        comments: post.comments,
      })),
      requested: limit,
      filtered: {
        alreadyDelivered,
        alreadyViewed,
        unavailable: freshIds.length - posts.length,
      },
      exhausted,
    };
  };

  const resolveLimit = (limit?: number) =>
    Math.min(Math.max(limit ?? DEFAULT_SEARCH_LIMIT, 1), MAX_SEARCH_LIMIT);

  // Deep offsets scan and discard every skipped row, so cap what the agent can ask for.
  const resolveOffset = (offset?: number) =>
    Math.min(Math.max(offset ?? 0, 0), MAX_CANDIDATE_OFFSET);

  const feedContext = { con, log } as unknown as Context;

  const queryScopedPostIds = async ({
    scope,
    sourceId,
    tag,
    orderBy,
    period,
    limit,
    offset,
  }: {
    scope: 'source' | 'tag';
    sourceId?: string;
    tag?: string;
    orderBy: FeedOrder;
    period?: number;
    limit: number;
    offset: number;
  }): Promise<string[]> =>
    queryReadReplica(con, async ({ queryRunner }) => {
      // The tag scope drives off post_keyword (IDX_post_keyword_status_keyword_postid)
      // instead of filtering posts with an EXISTS subquery: for a narrow tag the
      // planner would otherwise walk the post ordering index probing per row.
      const builder =
        scope === 'tag'
          ? queryRunner.manager
              .getRepository(PostKeyword)
              .createQueryBuilder('pk')
              .select('p.id', 'id')
              .innerJoin(Post, 'p', 'p.id = pk."postId"')
              .where('pk.keyword = :tag', { tag })
              .andWhere('pk.status = :keywordStatus', {
                keywordStatus: KeywordStatus.Allow,
              })
          : queryRunner.manager
              .getRepository(Post)
              .createQueryBuilder('p')
              .select('p.id', 'id')
              .where('p."sourceId" = :sourceId', { sourceId });

      builder
        .andWhere('p.deleted = false')
        .andWhere('p.private = false')
        .andWhere('p.banned = false')
        .andWhere('p.visible = true')
        .andWhere('p."showOnFeed" = true')
        .andWhere('p.type NOT IN (:...excludedTypes)', {
          excludedTypes: excludedInterestPostTypes,
        })
        .andWhere('p."sourceId" NOT IN (:...excludedSourceIds)', {
          excludedSourceIds,
        })
        .limit(limit)
        .offset(offset);

      if (period) {
        builder.andWhere('p."createdAt" >= :since', {
          since: new Date(Date.now() - period * ONE_DAY_IN_SECONDS * 1000),
        });
      }

      builder.orderBy(
        orderBy === 'date' ? 'p."createdAt"' : 'p.upvotes',
        'DESC',
      );

      const rows = await builder.getRawMany<{ id: string }>();
      return rows.map((row) => row.id);
    });

  const registerTools = (pi: ExtensionAPI) => {
    const budgetError = {
      error: 'budget_exhausted',
      hint: 'Deliver what you already have and call set_run_summary to finish. This is internal: never mention it in anything the user reads.',
    };
    const overBudget = () => {
      toolCalls += 1;
      return toolCalls > maxToolCalls;
    };

    pi.registerTool({
      name: 'search_daily_dev',
      label: 'Search daily.dev',
      description:
        "Keyword search across the whole daily.dev corpus. The only tool that turns free text into posts without needing a tag, source or seed post first, so it reaches things the tag vocabulary cannot name: a specific project, a library, a phrase, a niche technique. In exchange it applies no personalisation — the user's blocked tags, blocked sources, blocked words and followed sources are all ignored here, and results are ranked by textual match rather than engagement. Restricted to content published since the previous run, so it is narrow on a recurring interest and widest on the first run. Returns candidates with id, title, canonical url, publish date, upvotes and comment count; use offset to page deeper into the same query. The response reports how many results were filtered out and whether the index was exhausted.",
      parameters: Type.Object({
        query: Type.String(),
        limit: Type.Optional(Type.Number()),
        offset: Type.Optional(Type.Number()),
      }),
      execute: async (_id, params) => {
        if (overBudget()) {
          return jsonResult(budgetError);
        }
        const limit = resolveLimit(params.limit);
        const fetched = limit * CANDIDATE_OVERFETCH;
        const response: SearchResponse = await mimirClient.search(
          new SearchRequest({
            query: params.query,
            version: SEARCH_VERSION,
            offset: resolveOffset(params.offset),
            limit: fetched,
            filters: mimirFilterBuilder({
              publishedAfter: interest.lastRunAt ?? undefined,
            }),
          }),
        );
        const postIds = response.result
          .map((item) => item.postId)
          .filter(Boolean);
        const result = await toCandidates({ postIds, limit, fetched });
        log.info(
          {
            interestId: interest.id,
            query: params.query,
            mimirCount: response.result.length,
            candidateCount: result.candidates.length,
            filtered: result.filtered,
          },
          'interest agent search_daily_dev',
        );
        return jsonResult(result);
      },
    });

    pi.registerTool({
      name: 'query_feed',
      label: 'Query daily.dev feed',
      description:
        'Read a ranked daily.dev feed. scope "interest" uses this interest\'s saved tags, "tags" uses tags you supply, "source" reads one source\'s posts (pass sourceId), "tag" reads one tag\'s posts (pass tag). The interest and tags scopes run through the same ranking the user\'s own feed uses: engagement-ranked, and filtered by their blocked tags, blocked sources, blocked words and followed sources, so results are already shaped to this reader. They need tags to exist, and work at topic granularity rather than phrase granularity. No publish-date restriction, so these scopes reach older posts the interest has never seen. The source and tag scopes support orderBy "date" or "upvotes" and an optional period in days.',
      parameters: Type.Object({
        scope: Type.Optional(
          Type.Union([
            Type.Literal('interest'),
            Type.Literal('tags'),
            Type.Literal('source'),
            Type.Literal('tag'),
          ]),
        ),
        tags: Type.Optional(Type.Array(Type.String())),
        sourceId: Type.Optional(Type.String()),
        tag: Type.Optional(Type.String()),
        orderBy: Type.Optional(
          Type.Union([
            Type.Literal('relevance'),
            Type.Literal('date'),
            Type.Literal('upvotes'),
          ]),
        ),
        period: Type.Optional(Type.Number()),
        limit: Type.Optional(Type.Number()),
        offset: Type.Optional(Type.Number()),
      }),
      execute: async (_id, params) => {
        if (overBudget()) {
          return jsonResult(budgetError);
        }
        const scope = (params.scope ?? 'interest') as FeedScope;
        const orderBy = (params.orderBy ?? 'relevance') as FeedOrder;
        const limit = resolveLimit(params.limit);
        const fetched = limit * CANDIDATE_OVERFETCH;
        const offset = resolveOffset(params.offset);

        if (scope === 'source' || scope === 'tag') {
          if (scope === 'source' && !params.sourceId) {
            return jsonResult({ error: 'source_id_required' });
          }
          if (scope === 'tag' && !params.tag) {
            return jsonResult({ error: 'tag_required' });
          }
          if (
            scope === 'source' &&
            params.sourceId &&
            excludedSourceIds.includes(params.sourceId)
          ) {
            return jsonResult({
              error: 'source_excluded',
              hint: 'Collections, trends and digest sources aggregate other posts and cannot be browsed.',
            });
          }
          if (scope === 'source' && params.sourceId) {
            const source = await queryReadReplica(con, ({ queryRunner }) =>
              queryRunner.manager.getRepository(Source).findOne({
                select: ['id', 'private', 'active'],
                where: { id: params.sourceId },
              }),
            );
            if (!source || !source.active) {
              return jsonResult({ error: 'source_not_found' });
            }
            if (source.private && source.id !== interest.sourceId) {
              return jsonResult({ error: 'source_private' });
            }
          }

          const postIds = await queryScopedPostIds({
            scope,
            sourceId: params.sourceId,
            tag: params.tag,
            orderBy,
            period: params.period,
            limit: fetched,
            offset,
          });
          const result = await toCandidates({ postIds, limit, fetched });
          log.info(
            {
              interestId: interest.id,
              scope,
              sourceId: params.sourceId,
              tag: params.tag,
              candidateCount: result.candidates.length,
              filtered: result.filtered,
            },
            'interest agent query_feed',
          );
          return jsonResult(result);
        }

        const tags = params.tags?.length
          ? params.tags
          : (
              await queryReadReplica(con, ({ queryRunner }) =>
                queryRunner.manager.getRepository(FeedTag).find({
                  select: ['tag'],
                  where: { feedId: interest.feedId ?? '' },
                }),
              )
            ).map((row) => row.tag);

        if (!tags.length) {
          return jsonResult({
            candidates: [],
            error: 'no_tags',
            hint: 'Call set_interest_tags first, or pass tags explicitly.',
          });
        }

        const response = await getForYouByTagFeedGenerator(tags).generate(
          feedContext,
          {
            user_id: interest.userId,
            page_size: fetched,
            offset,
          },
        );
        const result = await toCandidates({
          postIds: getFeedResponsePostIds(response),
          limit,
          fetched,
        });
        log.info(
          {
            interestId: interest.id,
            scope,
            tags,
            feedCount: response.data.length,
            candidateCount: result.candidates.length,
            filtered: result.filtered,
          },
          'interest agent query_feed',
        );
        return jsonResult(result);
      },
    });

    pi.registerTool({
      name: 'read_post',
      label: 'Read post',
      description:
        "Read one post in full: engagement counts, quality signals, tags, source, author, summary and the community's take. Works on any post, including older ones and ones already delivered for this interest, so use it when the user asks about something specific. alreadyDelivered tells you whether this interest has surfaced it before.",
      parameters: Type.Object({
        postId: Type.String(),
      }),
      execute: async (_id, params) => {
        if (overBudget()) {
          return jsonResult(budgetError);
        }
        const post = await queryReadReplica(con, ({ queryRunner }) =>
          queryRunner.manager
            .getRepository(Post)
            .createQueryBuilder('p')
            .select([
              'p.id AS id',
              'p.type AS type',
              'p."subType" AS "subType"',
              'p.title AS title',
              'p.summary AS summary',
              'p.description AS description',
              'p.content AS content',
              'p."readTime" AS "readTime"',
              'p."createdAt" AS "createdAt"',
              'p."publishedAt" AS "publishedAt"',
              'p."tagsStr" AS "tagsStr"',
              'p.language AS language',
              'p."contentCuration" AS "contentCuration"',
              'p.views AS views',
              'p.upvotes AS upvotes',
              'p.downvotes AS downvotes',
              'p.comments AS comments',
              'p.awards AS awards',
              'p.trending AS trending',
              'p.score AS score',
              'p.url AS url',
              'p.slug AS slug',
              'p."contentQuality" AS "contentQuality"',
              'p."communitySentiment" AS "communitySentiment"',
              'p.toc AS toc',
              'p."sharedPostId" AS "sharedPostId"',
              's.id AS "sourceId"',
              's.handle AS "sourceHandle"',
              's.name AS "sourceName"',
              's.description AS "sourceDescription"',
              's.type AS "sourceType"',
              's.flags AS "sourceFlags"',
              'a.username AS "authorUsername"',
              'a.name AS "authorName"',
              'a.reputation AS "authorReputation"',
              'sp.id AS "sharedId"',
              'sp.title AS "sharedTitle"',
              'sp.summary AS "sharedSummary"',
            ])
            .leftJoin(Source, 's', 's.id = p."sourceId"')
            .leftJoin(User, 'a', 'a.id = p."authorId"')
            .leftJoin(Post, 'sp', 'sp.id = p."sharedPostId"')
            .where('p.id = :postId', { postId: params.postId })
            .andWhere('p.deleted = false')
            .andWhere(
              '((p.private = false AND p."showOnFeed" = true) OR p."sourceId" = :interestSourceId)',
              { interestSourceId: interest.sourceId },
            )
            .getRawOne(),
        );

        if (!post) {
          return jsonResult({ postId: params.postId, error: 'not_found' });
        }

        const [delivered, viewed] = await Promise.all([
          queryReadReplica(con, ({ queryRunner }) =>
            queryRunner.manager.getRepository(InterestFinding).findOne({
              select: ['createdAt'],
              where: { interestId: interest.id, postId: post.id },
            }),
          ),
          queryReadReplica(con, ({ queryRunner }) =>
            queryRunner.manager.getRepository(View).findOne({
              select: ['postId'],
              where: { userId: interest.userId, postId: post.id },
            }),
          ),
        ]);

        return jsonResult({
          postId: post.id,
          type: post.type,
          subType: post.subType,
          title: post.title,
          summary: post.summary,
          description: post.description,
          content: post.content,
          url: post.url,
          permalink: getDiscussionLink(post.slug ?? post.id),
          readTime: post.readTime,
          publishedAt: (post.publishedAt ?? post.createdAt)?.toISOString(),
          language: post.language,
          tags: post.tagsStr ? post.tagsStr.split(',') : [],
          contentCuration: post.contentCuration,
          engagement: {
            upvotes: post.upvotes,
            downvotes: post.downvotes,
            comments: post.comments,
            views: post.views,
            awards: post.awards,
            trending: post.trending,
            score: post.score,
          },
          contentQuality: post.contentQuality,
          communitySentiment: post.communitySentiment,
          toc: post.toc,
          source: post.sourceId
            ? {
                id: post.sourceId,
                handle: post.sourceHandle,
                name: post.sourceName,
                description: post.sourceDescription,
                type: post.sourceType,
                totalPosts: post.sourceFlags?.totalPosts,
                totalUpvotes: post.sourceFlags?.totalUpvotes,
                totalMembers: post.sourceFlags?.totalMembers,
              }
            : null,
          author: post.authorUsername
            ? {
                username: post.authorUsername,
                name: post.authorName,
                reputation: post.authorReputation,
              }
            : null,
          sharedPost: post.sharedId
            ? {
                postId: post.sharedId,
                title: post.sharedTitle,
                summary: post.sharedSummary,
              }
            : null,
          alreadyDelivered: !!delivered,
          deliveredAt: delivered?.createdAt?.toISOString() ?? null,
          alreadyViewed: !!viewed,
        });
      },
    });

    pi.registerTool({
      name: 'read_comments',
      label: 'Read post comments',
      description:
        'Read the discussion on a post: top-level comments with their replies, ranked by upvotes or recency, including each author and their vote counts. Use it to tell whether a post is genuinely useful or merely popular. Long threads are truncated.',
      parameters: Type.Object({
        postId: Type.String(),
        sortBy: Type.Optional(
          Type.Union([Type.Literal('upvotes'), Type.Literal('newest')]),
        ),
        limit: Type.Optional(Type.Number()),
      }),
      execute: async (_id, params) => {
        if (overBudget()) {
          return jsonResult(budgetError);
        }
        const limit = Math.min(
          Math.max(params.limit ?? DEFAULT_COMMENT_LIMIT, 1),
          MAX_COMMENT_LIMIT,
        );
        const order: 'c.upvotes' | 'c."createdAt"' =
          params.sortBy === 'newest' ? 'c."createdAt"' : 'c.upvotes';

        const selectComments = (
          manager: EntityManager,
          parentIsNull: boolean,
        ) =>
          manager
            .getRepository(Comment)
            .createQueryBuilder('c')
            .select([
              'c.id AS id',
              'c."parentId" AS "parentId"',
              'c.content AS content',
              'c.upvotes AS upvotes',
              'c.downvotes AS downvotes',
              'c.awards AS awards',
              'c."createdAt" AS "createdAt"',
              'u.username AS username',
              'u.reputation AS reputation',
            ])
            .leftJoin(User, 'u', 'u.id = c."userId"')
            .where('c."postId" = :postId', { postId: params.postId })
            .andWhere(`c.flags->>'vordr' IS DISTINCT FROM 'true'`)
            .andWhere(
              parentIsNull
                ? 'c."parentId" IS NULL'
                : 'c."parentId" IN (:...parentIds)',
            );

        const { topLevel, replies } = await queryReadReplica(
          con,
          async ({ queryRunner }) => {
            const parents = await selectComments(queryRunner.manager, true)
              .orderBy(order, 'DESC')
              .limit(limit)
              .getRawMany();

            if (!parents.length) {
              return { topLevel: parents, replies: [] };
            }

            // Capped and ranked by upvotes so a busy thread cannot pull thousands
            // of rows that the character budget below would discard anyway;
            // chronological order is restored per parent when rendering.
            const children = await selectComments(queryRunner.manager, false)
              .setParameter(
                'parentIds',
                parents.map((comment) => comment.id),
              )
              .orderBy('c.upvotes', 'DESC')
              .limit(MAX_COMMENT_REPLIES)
              .getRawMany();

            return { topLevel: parents, replies: children };
          },
        );

        if (!topLevel.length) {
          return jsonResult({ postId: params.postId, comments: [] });
        }

        let budget = MAX_COMMENT_CHARS;
        let truncated = false;
        const render = (comment: Record<string, unknown>) => {
          const text = String(comment.content ?? '').slice(
            0,
            MAX_COMMENT_LENGTH,
          );
          if (budget <= 0) {
            truncated = true;
            return null;
          }
          budget -= text.length;
          return {
            author: comment.username,
            reputation: comment.reputation,
            upvotes: comment.upvotes,
            downvotes: comment.downvotes,
            awards: comment.awards,
            createdAt: (comment.createdAt as Date)?.toISOString(),
            content: text,
          };
        };

        const comments = topLevel
          .map((comment) => {
            const rendered = render(comment);
            if (!rendered) {
              return null;
            }
            return {
              ...rendered,
              replies: replies
                .filter((reply) => reply.parentId === comment.id)
                .sort(
                  (a, b) =>
                    (a.createdAt as Date).getTime() -
                    (b.createdAt as Date).getTime(),
                )
                .map(render)
                .filter(Boolean),
            };
          })
          .filter(Boolean);

        return jsonResult({
          postId: params.postId,
          totalComments: topLevel.length + replies.length,
          truncated,
          comments,
        });
      },
    });

    pi.registerTool({
      name: 'get_source',
      label: 'Get source',
      description:
        'Describe one daily.dev source (a publication, blog or squad) by id or handle: what it is, how much it publishes, how much engagement it gets, and the tags it publishes about most. Read its posts with query_feed scope "source".',
      parameters: Type.Object({
        source: Type.String(),
      }),
      execute: async (_id, params) => {
        if (overBudget()) {
          return jsonResult(budgetError);
        }
        if (excludedSourceIds.includes(params.source)) {
          return jsonResult({
            error: 'source_excluded',
            hint: 'Collections, trends and digest sources aggregate other posts and cannot be browsed.',
          });
        }
        const source = await queryReadReplica(con, ({ queryRunner }) =>
          queryRunner.manager.getRepository(Source).findOne({
            select: [
              'id',
              'name',
              'handle',
              'description',
              'type',
              'createdAt',
              'flags',
              'private',
              'active',
            ],
            where: [{ id: params.source }, { handle: params.source }],
          }),
        );
        if (!source || !source.active) {
          return jsonResult({ error: 'source_not_found' });
        }
        if (source.private && source.id !== interest.sourceId) {
          return jsonResult({ error: 'source_private' });
        }

        const tags = await queryReadReplica(con, ({ queryRunner }) =>
          queryRunner.manager.getRepository(SourceTagView).find({
            select: ['tag'],
            where: { sourceId: source.id },
            order: { count: 'DESC' },
            take: SOURCE_TOP_TAGS,
          }),
        );

        return jsonResult({
          id: source.id,
          handle: source.handle,
          name: source.name,
          description: source.description,
          type: source.type,
          createdAt: source.createdAt?.toISOString(),
          totalPosts: source.flags?.totalPosts,
          totalUpvotes: source.flags?.totalUpvotes,
          totalViews: source.flags?.totalViews,
          totalMembers: source.flags?.totalMembers,
          topTags: tags.map((row) => row.tag),
        });
      },
    });

    pi.registerTool({
      name: 'get_tag',
      label: 'Get tag',
      description:
        'Describe one daily.dev tag: its title and description, how many posts carry it, tags commonly used alongside it, and the sources that publish about it most. Synonyms resolve to their canonical tag. Read its posts with query_feed scope "tag".',
      parameters: Type.Object({
        tag: Type.String(),
      }),
      execute: async (_id, params) => {
        if (overBudget()) {
          return jsonResult(budgetError);
        }
        const requested = params.tag.trim().toLowerCase();
        const findKeyword = (value: string) =>
          queryReadReplica(con, ({ queryRunner }) =>
            queryRunner.manager.getRepository(Keyword).findOne({
              where: { value },
            }),
          );
        let keyword = await findKeyword(requested);
        let resolvedFrom: string | null = null;
        if (keyword?.status === KeywordStatus.Synonym && keyword.synonym) {
          resolvedFrom = keyword.value;
          keyword = await findKeyword(keyword.synonym);
        }
        if (!keyword || keyword.status !== KeywordStatus.Allow) {
          return jsonResult({
            tag: requested,
            error: 'tag_not_found',
            hint: 'Use search_tags to find a real tag slug.',
          });
        }

        const [related, sources] = await Promise.all([
          queryReadReplica(con, ({ queryRunner }) =>
            queryRunner.manager.getRepository(TagRecommendation).find({
              select: ['keywordY'],
              where: { keywordX: keyword.value },
              order: { probability: 'DESC' },
              take: SOURCE_TOP_TAGS,
            }),
          ),
          queryReadReplica(con, ({ queryRunner }) =>
            queryRunner.manager.getRepository(SourceTagView).find({
              select: ['sourceId'],
              where: { tag: keyword.value },
              order: { count: 'DESC' },
              take: SOURCE_TOP_TAGS,
            }),
          ),
        ]);

        const sourceIds = sources
          .map((row) => row.sourceId)
          .filter((id) => !excludedSourceIds.includes(id));

        return jsonResult({
          tag: keyword.value,
          resolvedFrom,
          title: keyword.flags?.title,
          description: keyword.flags?.description,
          occurrences: keyword.occurrences,
          relatedTags: related.map((row) => row.keywordY),
          topSourceIds: sourceIds,
        });
      },
    });

    pi.registerTool({
      name: 'search_tags',
      label: 'Search tags',
      description:
        'Find real daily.dev tag slugs matching a fragment. Use this before set_interest_tags rather than guessing slugs — tags that do not exist are silently dropped.',
      parameters: Type.Object({
        query: Type.String(),
        limit: Type.Optional(Type.Number()),
      }),
      execute: async (_id, params) => {
        if (overBudget()) {
          return jsonResult(budgetError);
        }
        const limit = Math.min(
          Math.max(params.limit ?? DEFAULT_LOOKUP_LIMIT, 1),
          MAX_LOOKUP_LIMIT,
        );
        const rows = await queryReadReplica(con, ({ queryRunner }) =>
          queryRunner.manager
            .getRepository(Keyword)
            .createQueryBuilder('k')
            .select(['k.value AS value', 'k.occurrences AS occurrences'])
            .where('k.status = :status', { status: KeywordStatus.Allow })
            .andWhere('k.value ILIKE :query', { query: `%${params.query}%` })
            .orderBy('k.occurrences', 'DESC')
            .limit(limit)
            .getRawMany(),
        );
        return jsonResult({
          tags: rows.map((row) => ({
            tag: row.value,
            occurrences: row.occurrences,
          })),
        });
      },
    });

    pi.registerTool({
      name: 'search_sources',
      label: 'Search sources',
      description:
        'Find daily.dev sources whose name or handle matches a fragment. Returns ids you can pass to get_source or query_feed scope "source".',
      parameters: Type.Object({
        query: Type.String(),
        limit: Type.Optional(Type.Number()),
      }),
      execute: async (_id, params) => {
        if (overBudget()) {
          return jsonResult(budgetError);
        }
        const limit = Math.min(
          Math.max(params.limit ?? DEFAULT_LOOKUP_LIMIT, 1),
          MAX_LOOKUP_LIMIT,
        );
        const rows = await queryReadReplica(con, ({ queryRunner }) =>
          queryRunner.manager
            .getRepository(Source)
            .createQueryBuilder('s')
            .select([
              's.id AS id',
              's.handle AS handle',
              's.name AS name',
              's.description AS description',
            ])
            .where('(s.name ILIKE :query OR s.handle ILIKE :query)', {
              query: `%${params.query}%`,
            })
            .andWhere('s.active = true')
            .andWhere('s.private = false')
            .andWhere('s.id NOT IN (:...excludedSourceIds)', {
              excludedSourceIds,
            })
            .limit(limit)
            .getRawMany(),
        );
        return jsonResult({ sources: rows });
      },
    });

    pi.registerTool({
      name: 'add_finding',
      label: 'Add to interest feed',
      description:
        "Add a topically-relevant post to the interest's feed as a finding. Pass your own topical-relevance score (0-1) and a short rationale. Rejects scores below the interest's FOMO threshold, posts already found for this interest, and aggregation posts such as collections, trends and digests.",
      parameters: Type.Object({
        postId: Type.String(),
        score: Type.Number({ minimum: 0, maximum: 1 }),
        rationale: Type.String(),
      }),
      execute: async (_id, params) => {
        if (overBudget()) {
          return jsonResult(budgetError);
        }
        // Both on primary: this must see findings inserted earlier in this run.
        const [post, delivered] = await Promise.all([
          con.getRepository(Post).findOne({
            select: ['id', 'type', 'sourceId'],
            where: {
              id: params.postId,
              private: false,
              deleted: false,
              showOnFeed: true,
            },
          }),
          getDeliveredIds([params.postId], con.manager),
        ]);
        if (!post) {
          return jsonResult({
            postId: params.postId,
            added: false,
            error: 'not_public',
          });
        }
        if (
          excludedInterestPostTypes.includes(post.type) ||
          excludedSourceIds.includes(post.sourceId)
        ) {
          return jsonResult({
            postId: params.postId,
            added: false,
            error: 'excluded_content_type',
          });
        }
        const score = params.score;
        const threshold = interest.fomoThreshold ?? 0.5;
        if (score < threshold) {
          return jsonResult({
            postId: params.postId,
            added: false,
            error: 'below_fomo_threshold',
            score,
            threshold,
          });
        }

        if (delivered.has(params.postId)) {
          return jsonResult({
            postId: params.postId,
            added: false,
            error: 'already_delivered',
          });
        }

        const insertResult = await con
          .getRepository(InterestFinding)
          .createQueryBuilder()
          .insert()
          .values({
            id: await generateShortId(),
            interestId: interest.id,
            postId: params.postId,
            score,
            rationale: params.rationale,
            status: InterestFindingStatus.New,
            origin: InterestFindingOrigin.Search,
          })
          .orIgnore()
          .execute();

        if (!(insertResult.raw as unknown[])?.length) {
          return jsonResult({
            postId: params.postId,
            added: false,
            error: 'already_delivered',
          });
        }

        addedPostIds.add(params.postId);
        state.findingsAdded += 1;
        log.info(
          {
            interestId: interest.id,
            postId: params.postId,
            score,
            rationale: params.rationale,
          },
          'interest agent add_finding',
        );
        return jsonResult({ postId: params.postId, added: true });
      },
    });

    pi.registerTool({
      name: 'set_run_summary',
      label: 'Set run summary',
      description: `Write the summary the user sees in their notification. One or two short sentences, at most ${MAX_RUN_SUMMARY_LENGTH} characters; anything longer is truncated. Sell the single most interesting thing being delivered, in plain language, without counts-only phrasing. This is product copy read by someone who knows nothing about how you work: never mention tools, tool errors, budgets, limits, scores, thresholds, filtered results, tags, feeds, or anything else internal, and never apologise or explain what you could not do. See <output_voice>.`,
      parameters: Type.Object({
        summary: Type.String(),
      }),
      execute: async (_id, params) => {
        const summary = params.summary.trim().replace(/\s+/g, ' ');
        state.agentSummary = summary
          ? summary.slice(0, MAX_RUN_SUMMARY_LENGTH)
          : null;
        return jsonResult({ saved: true });
      },
    });

    pi.registerTool({
      name: 'write_post',
      label: 'Write summary post',
      description:
        "Write a short markdown digest of what you found in THIS run. Hosted in the interest's source. Refused when this run added no findings, so it can never re-describe previous runs. When you link a post, use ONLY an exact url returned by a tool — never invent, shorten, or guess a URL, and never write relative links. This is product copy: write about the content only, never about tools, tool errors, budgets, limits, scores, thresholds, filtered results, or anything else internal, and never apologise or explain what you could not do. See <output_voice>.",
      parameters: Type.Object({
        title: Type.String(),
        content: Type.String(),
      }),
      execute: async (_id, params) => {
        if (overBudget()) {
          return jsonResult(budgetError);
        }
        if (!addedPostIds.size && !pendingFindings.length) {
          return jsonResult({
            error: 'nothing_new_to_report',
            hint: 'This run added no findings and none are waiting to be delivered, so there is nothing new to summarise.',
          });
        }
        const id = await generateShortId();
        const saved = await insertFreeformPost({
          con,
          args: {
            id,
            title: params.title,
            content: params.content,
            contentHtml: markdown.render(params.content),
            authorId: interest.userId,
            sourceId: interest.sourceId as string,
          },
        });
        await con.getRepository(Post).update(
          { id: saved.id },
          {
            showOnFeed: false,
            flags: updateFlagsStatement<Post>({ showOnFeed: false }),
          },
        );
        state.summaryPostId = saved.id;
        return jsonResult({ postId: saved.id });
      },
    });

    pi.registerTool({
      name: 'set_interest_tags',
      label: 'Set interest tags',
      description:
        'Set the daily.dev tags that best represent this interest. Replaces the existing set. These tags outlive the run: they are what query_feed scope "interest" reads, and they are matched against every post published on daily.dev between runs, so a matching post can be caught for this user without an agent run at all. Getting them right is the most durable thing you can do here. Use real daily.dev tag slugs (lowercase, hyphenated) — confirm them with search_tags, because unknown slugs are silently dropped and the response tells you which ones were.',
      parameters: Type.Object({
        tags: Type.Array(Type.String()),
      }),
      execute: async (_id, params) => {
        if (overBudget()) {
          return jsonResult(budgetError);
        }
        const feedId = interest.feedId;
        if (!feedId) {
          return jsonResult({ savedTags: [] });
        }
        const valid = await queryReadReplica(con, ({ queryRunner }) =>
          queryRunner.manager.getRepository(Keyword).find({
            select: ['value'],
            where: { value: In(params.tags), status: KeywordStatus.Allow },
          }),
        );
        const validTags = valid
          .map((keyword) => keyword.value)
          .slice(0, maxTags);
        const dropped = params.tags.filter((tag) => !validTags.includes(tag));
        await replaceFeedTags({ con, feedId, tags: validTags, maxTags });
        return jsonResult({ savedTags: validTags, dropped });
      },
    });

    pi.registerTool({
      name: 'discover_external',
      label: 'Discover external content',
      description:
        "Search the web for content matching the interest. Pass a focused search query. Matching pages are ingested into daily.dev and added to the interest's feed as findings. Treat this as an equal inventory to daily.dev search and use it freely on every run — not just when daily.dev is thin.",
      parameters: Type.Object({
        query: Type.String(),
        limit: Type.Optional(Type.Number()),
      }),
      execute: async (_id, params) => {
        if (overBudget()) {
          return jsonResult(budgetError);
        }
        const maxCalls =
          remoteConfig.vars.interestAgentMaxWebSearchesPerRun ??
          DEFAULT_MAX_WEB_SEARCHES_PER_RUN;
        discoverCalls += 1;
        if (discoverCalls > maxCalls) {
          return jsonResult({
            error: 'web_search_budget_exhausted',
            maxCalls,
          });
        }

        const result = await discoverAndIngestExternal({
          con,
          logger,
          interest,
          query: params.query,
          limit: params.limit,
        });
        result.postIds.forEach((postId) => addedPostIds.add(postId));
        state.findingsAdded += result.added;
        return jsonResult({
          discovered: result.discovered,
          added: result.added,
        });
      },
    });
  };

  const maxTags =
    remoteConfig.vars.interestAgentMaxTags ?? DEFAULT_INTEREST_MAX_TAGS;

  const [feedbackRows, currentTagRows] = await Promise.all([
    queryReadReplica(con, ({ queryRunner }) =>
      queryRunner.manager.getRepository(InterestFeedback).find({
        select: ['text', 'createdAt'],
        where: { interestId: interest.id },
        order: { createdAt: 'DESC' },
        take: 5,
      }),
    ),
    interest.feedId
      ? queryReadReplica(con, ({ queryRunner }) =>
          queryRunner.manager.getRepository(FeedTag).find({
            select: ['tag'],
            where: { feedId: interest.feedId as string },
          }),
        )
      : Promise.resolve([]),
  ]);
  const feedback = feedbackRows.reverse();
  const currentTags = currentTagRows.map((row) => row.tag);

  const activeTools = getInterestAgentTools(
    interest.outputModes,
    interest.sources,
  );

  const resourceLoader = new DefaultResourceLoader({
    cwd: agentDir,
    agentDir,
    systemPromptOverride: () =>
      buildSystemPrompt(
        interest,
        feedback,
        currentTags,
        maxTags,
        maxToolCalls,
        pendingFindings,
      ),
    appendSystemPromptOverride: () => [],
    extensionFactories: [registerTools],
  });
  await resourceLoader.reload();

  const { session } = await createAgentSession({
    cwd: agentDir,
    agentDir,
    authStorage,
    modelRegistry,
    model,
    thinkingLevel: 'low',
    resourceLoader,
    sessionManager: SessionManager.inMemory(agentDir),
    tools: activeTools,
  });

  const unsubscribe = session.subscribe((event) => {
    if (event.type === 'message_end') {
      const message = event.message as {
        role?: string;
        content?: { type?: string; text?: string }[];
      };
      if (message.role !== 'assistant' || !Array.isArray(message.content)) {
        return;
      }
      const text = message.content
        .map((part) => (typeof part?.text === 'string' ? part.text : ''))
        .filter(Boolean)
        .join('\n')
        .trim();
      if (text) {
        log.info({ interestId: interest.id, text }, 'interest agent message');
      }
    } else if (event.type === 'tool_execution_end' && event.isError) {
      log.warn(
        { interestId: interest.id, tool: event.toolName },
        'interest agent tool error',
      );
    }
  });

  try {
    await session.prompt(
      `Run a discovery pass for the interest "${interest.query}" and deliver what you find.`,
    );
  } finally {
    unsubscribe();
    session.dispose();
  }

  const feedId = interest.feedId;
  if (feedId && addedPostIds.size) {
    const keywords = await queryReadReplica(con, ({ queryRunner }) =>
      queryRunner.manager.getRepository(PostKeyword).find({
        select: ['keyword'],
        where: { postId: In([...addedPostIds]), status: KeywordStatus.Allow },
      }),
    );
    await addFeedTagsWithinCap({
      con,
      feedId,
      tags: keywords.map((row) => row.keyword),
      maxTags,
    });
  }

  // Only for logs. Never persisted as lastRunSummary — that value is rendered
  // verbatim as the notification headline, so a machine-generated recap there
  // ships copy like "Added 0 finding(s) this run." to the user.
  state.summary =
    state.agentSummary ??
    `Added ${state.findingsAdded} finding(s) this run${
      state.summaryPostId ? ', wrote a summary post' : ''
    }.`;

  log.info(
    { interestId: interest.id, ...state },
    'interest agent run complete',
  );

  return state;
};
