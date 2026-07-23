import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  type ExtensionAPI,
} from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import {
  AudienceFitRequest,
  SearchRequest,
  type SearchResponse,
} from '@dailydotdev/schema';
import type { DataSource } from 'typeorm';
import type { FastifyBaseLogger } from 'fastify';
import { In, MoreThanOrEqual } from 'typeorm';
import { mimirClient } from '../../integrations/mimir/clients';
import { mimirFilterBuilder } from '../../integrations/mimir/filters';
import { getBragiClient } from '../../integrations/bragi/clients';
import { Post } from '../../entity/posts/Post';
import { PostKeyword } from '../../entity/PostKeyword';
import { Keyword, KeywordStatus } from '../../entity/Keyword';
import { FeedTag } from '../../entity/FeedTag';
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
const SEARCH_VERSION = 3;
const DEFAULT_MAX_WEB_SEARCHES_PER_RUN = 3;
const DEFAULT_MAX_DISCOVERIES_PER_DAY = 30;
const DISCOVERY_BATCH_SIZE = 10;

export type InterestAgentRunResult = {
  findingsAdded: number;
  summaryPostId: string | null;
  summary: string;
};

export const getInterestAgentTools = (
  outputModes?: UserInterest['outputModes'],
  sources?: UserInterest['sources'],
): string[] => {
  const feed = outputModes?.feed ?? true;
  const tools = ['set_interest_tags', 'search_daily_dev'];
  if (feed) {
    tools.push('score_finding', 'add_to_feed');
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
  feedback: string[],
  currentTags: string[],
  maxTags: number,
): string => {
  const { feed = true, post = true } = interest.outputModes ?? {};
  const externalEnabled = feed && !!interest.sources?.web;
  const steps = [
    `1. Call set_interest_tags with the full set of daily.dev tag slugs that represent this interest (max ${maxTags}); it replaces the current set, so include the ones worth keeping and drop the rest.`,
    '2. Call search_daily_dev with a focused query derived from the interest.',
  ];
  if (feed) {
    steps.push(
      `${steps.length + 1}. For each promising result, call score_finding — it returns an audienceFit quality signal (0-1) that reflects general daily.dev content quality, NOT topical relevance to this interest.`,
      `${steps.length + 2}. Judge topical relevance yourself from the title and summary. Call add_to_feed only for results that genuinely match the interest, passing a relevance score (0-1) for how well the post matches the interest, plus a short rationale.`,
    );
    if (externalEnabled) {
      steps.push(
        `${steps.length + 1}. If daily.dev doesn't have enough strong matches, call discover_external with a focused search query to pull in external web content — it is ingested into daily.dev and added to the feed automatically.`,
      );
    }
  }
  if (post) {
    steps.push(
      `${steps.length + 1}. Call write_post once with a short markdown digest of what you found and why it matters. When linking a post, use ONLY the exact url returned by search_daily_dev — never invent or guess URLs.`,
    );
  }

  return [
    'You are the daily.dev Interest Agent. You hunt for content matching a single user interest, score it, and deliver it.',
    `The interest is: "${interest.query}".`,
    externalEnabled
      ? 'Prefer daily.dev content; use discover_external only to fill gaps. Never invent URLs — only use urls returned by search_daily_dev or discover_external.'
      : 'Work only with daily.dev content in this run — do not invent URLs or reference external sources.',
    'Be strict about topical relevance: a well-written post about a different topic must NOT be surfaced. Only add_to_feed posts that are genuinely about the interest.',
    `FOMO threshold is ${interest.fomoThreshold ?? 0.5} (0 = surface everything, 1 = only the very best). Only add_to_feed items whose relevance score is at or above this threshold.`,
    currentTags.length
      ? `Current tags for this interest: ${currentTags.join(', ')}.`
      : null,
    interest.lastRunSummary
      ? `Recap of your last run: ${interest.lastRunSummary}`
      : null,
    feedback.length
      ? `Recent user feedback to apply:\n${feedback.map((text) => `- ${text}`).join('\n')}`
      : null,
    'Run this loop once and then stop:',
    ...steps,
    'Keep tool usage efficient. When the delivery is done, reply with a one-sentence recap of the run.',
  ]
    .filter(Boolean)
    .join('\n');
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

  const state: InterestAgentRunResult = {
    findingsAdded: 0,
    summaryPostId: null,
    summary: '',
  };

  const scores = new Map<string, number>();
  const addedPostIds = new Set<string>();
  let discoverCalls = 0;

  const registerTools = (pi: ExtensionAPI) => {
    pi.registerTool({
      name: 'search_daily_dev',
      label: 'Search daily.dev',
      description:
        'Search daily.dev for posts matching a query. Returns candidate posts with their ids, titles, and canonical daily.dev urls.',
      parameters: Type.Object({
        query: Type.String(),
        limit: Type.Optional(Type.Number()),
      }),
      execute: async (_id, params) => {
        const response: SearchResponse = await mimirClient.search(
          new SearchRequest({
            query: params.query,
            version: SEARCH_VERSION,
            offset: 0,
            limit: params.limit ?? DEFAULT_SEARCH_LIMIT,
            filters: mimirFilterBuilder({}),
          }),
        );
        const postIds = response.result
          .map((item) => item.postId)
          .filter(Boolean);
        const posts = postIds.length
          ? await con.getRepository(Post).find({
              select: ['id', 'title', 'slug'],
              where: {
                id: In(postIds),
                private: false,
                deleted: false,
                showOnFeed: true,
              },
            })
          : [];
        const candidates = posts.map((post) => ({
          postId: post.id,
          title: post.title,
          url: getDiscussionLink(post.slug ?? post.id),
        }));
        log.info(
          {
            interestId: interest.id,
            query: params.query,
            mimirCount: response.result.length,
            candidateCount: candidates.length,
            candidates,
          },
          'interest agent search_daily_dev',
        );
        return {
          content: [{ type: 'text', text: JSON.stringify({ candidates }) }],
          details: {},
        };
      },
    });

    pi.registerTool({
      name: 'score_finding',
      label: 'Score finding',
      description:
        'Return the audienceFit quality signal (0-1) for a daily.dev post. This measures general content quality for the daily.dev audience, NOT topical relevance to the interest — judge relevance yourself before surfacing.',
      parameters: Type.Object({
        postId: Type.String(),
      }),
      execute: async (_id, params) => {
        const post = await con.getRepository(Post).findOne({
          select: ['id', 'title', 'summary', 'type'],
          where: {
            id: params.postId,
            private: false,
            deleted: false,
            showOnFeed: true,
          },
        });
        if (!post) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  postId: params.postId,
                  error: 'not_found',
                }),
              },
            ],
            details: {},
          };
        }
        const bragiClient = getBragiClient();
        const response = await bragiClient.garmr.execute(() =>
          bragiClient.instance.audienceFit(
            new AudienceFitRequest({
              title: post.title ?? '',
              content: post.summary ?? '',
              contentType: post.type,
            }),
          ),
        );
        scores.set(post.id, response.audienceFit);
        log.info(
          {
            interestId: interest.id,
            postId: post.id,
            title: post.title,
            score: response.audienceFit,
          },
          'interest agent score_finding',
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                postId: post.id,
                score: response.audienceFit,
              }),
            },
          ],
          details: {},
        };
      },
    });

    pi.registerTool({
      name: 'add_to_feed',
      label: 'Add to interest feed',
      description:
        "Add a topically-relevant post to the interest's feed as a finding. Pass score as your relevance judgment (0-1) for how well the post matches the interest, plus a short rationale. Only call this for posts genuinely about the interest.",
      parameters: Type.Object({
        postId: Type.String(),
        score: Type.Optional(Type.Number()),
        rationale: Type.String(),
      }),
      execute: async (_id, params) => {
        const post = await con.getRepository(Post).findOne({
          select: ['id'],
          where: {
            id: params.postId,
            private: false,
            deleted: false,
            showOnFeed: true,
          },
        });
        if (!post) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  postId: params.postId,
                  added: false,
                  error: 'not_public',
                }),
              },
            ],
            details: {},
          };
        }
        const score = params.score ?? scores.get(params.postId) ?? 0;
        await con
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
          .orUpdate(['score', 'rationale', 'status'], ['interestId', 'postId'])
          .execute();
        addedPostIds.add(params.postId);
        state.findingsAdded += 1;
        log.info(
          {
            interestId: interest.id,
            postId: params.postId,
            score,
            rationale: params.rationale,
          },
          'interest agent add_to_feed',
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ postId: params.postId, added: true }),
            },
          ],
          details: {},
        };
      },
    });

    pi.registerTool({
      name: 'write_post',
      label: 'Write summary post',
      description:
        "Write a short markdown digest post summarizing the findings. Hosted in the interest's source. When you link a post, use ONLY the exact `url` returned by search_daily_dev — never invent, shorten, or guess a URL, and never write relative links.",
      parameters: Type.Object({
        title: Type.String(),
        content: Type.String(),
      }),
      execute: async (_id, params) => {
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
        return {
          content: [
            { type: 'text', text: JSON.stringify({ postId: saved.id }) },
          ],
          details: {},
        };
      },
    });

    pi.registerTool({
      name: 'set_interest_tags',
      label: 'Set interest tags',
      description:
        'Set the daily.dev tags that best represent this interest so future matching posts are caught automatically. Use real daily.dev tag slugs (lowercase, hyphenated).',
      parameters: Type.Object({
        tags: Type.Array(Type.String()),
      }),
      execute: async (_id, params) => {
        const feedId = interest.feedId;
        if (!feedId) {
          return {
            content: [
              { type: 'text', text: JSON.stringify({ savedTags: [] }) },
            ],
            details: {},
          };
        }
        const valid = await con.getRepository(Keyword).find({
          select: ['value'],
          where: { value: In(params.tags), status: KeywordStatus.Allow },
        });
        const validTags = valid
          .map((keyword) => keyword.value)
          .slice(0, maxTags);
        await replaceFeedTags({ con, feedId, tags: validTags, maxTags });
        return {
          content: [
            { type: 'text', text: JSON.stringify({ savedTags: validTags }) },
          ],
          details: {},
        };
      },
    });

    pi.registerTool({
      name: 'discover_external',
      label: 'Discover external content',
      description:
        "Search the web for content matching the interest that is NOT already on daily.dev. Pass a focused search query. Matching pages are ingested into daily.dev and added to the interest's feed as findings. Use this to broaden beyond daily.dev's existing content.",
      parameters: Type.Object({
        query: Type.String(),
        limit: Type.Optional(Type.Number()),
      }),
      execute: async (_id, params) => {
        const respond = (payload: Record<string, unknown>) => ({
          content: [{ type: 'text', text: JSON.stringify(payload) }],
          details: {},
        });

        const maxCalls =
          remoteConfig.vars.interestAgentMaxWebSearchesPerRun ??
          DEFAULT_MAX_WEB_SEARCHES_PER_RUN;
        discoverCalls += 1;
        if (discoverCalls > maxCalls) {
          return respond({ error: 'web_search_budget_exhausted', maxCalls });
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
        return respond({ discovered: result.discovered, added: result.added });
      },
    });
  };

  const feedbackRows = await con.getRepository(InterestFeedback).find({
    select: ['text'],
    where: { interestId: interest.id },
    order: { createdAt: 'DESC' },
    take: 5,
  });
  const feedback = feedbackRows.map((row) => row.text).reverse();

  const maxTags =
    remoteConfig.vars.interestAgentMaxTags ?? DEFAULT_INTEREST_MAX_TAGS;
  const currentTagRows = interest.feedId
    ? await con.getRepository(FeedTag).find({
        select: ['tag'],
        where: { feedId: interest.feedId },
      })
    : [];
  const currentTags = currentTagRows.map((row) => row.tag);

  const activeTools = getInterestAgentTools(
    interest.outputModes,
    interest.sources,
  );

  const resourceLoader = new DefaultResourceLoader({
    cwd: agentDir,
    agentDir,
    systemPromptOverride: () =>
      buildSystemPrompt(interest, feedback, currentTags, maxTags),
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
      `Hunt daily.dev for content matching the interest "${interest.query}" and deliver it now.`,
    );
  } finally {
    unsubscribe();
    session.dispose();
  }

  const feedId = interest.feedId;
  if (feedId && addedPostIds.size) {
    const keywords = await con.getRepository(PostKeyword).find({
      select: ['keyword'],
      where: { postId: In([...addedPostIds]), status: KeywordStatus.Allow },
    });
    await addFeedTagsWithinCap({
      con,
      feedId,
      tags: keywords.map((row) => row.keyword),
      maxTags,
    });
  }

  state.summary = `Added ${state.findingsAdded} finding(s) this run${
    state.summaryPostId ? ', wrote a summary post' : ''
  }.`;

  log.info(
    { interestId: interest.id, ...state },
    'interest agent run complete',
  );

  return state;
};
