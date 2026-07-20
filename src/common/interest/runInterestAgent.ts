import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
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
import { In } from 'typeorm';
import { mimirClient } from '../../integrations/mimir/clients';
import { getBragiClient } from '../../integrations/bragi/clients';
import { Post } from '../../entity/posts/Post';
import { PostKeyword } from '../../entity/PostKeyword';
import { Keyword, KeywordStatus } from '../../entity/Keyword';
import { FeedTag } from '../../entity/FeedTag';
import {
  InterestFinding,
  InterestFindingStatus,
} from '../../entity/InterestFinding';
import { InterestFeedback } from '../../entity/InterestFeedback';
import type { UserInterest } from '../../entity/UserInterest';
import { insertFreeformPost } from '../post';
import { markdown } from '../markdown';
import { updateFlagsStatement } from '../utils';
import { generateShortId } from '../../ids';
import { remoteConfig } from '../../remoteConfig';
import {
  addFeedTagsWithinCap,
  replaceFeedTags,
  DEFAULT_INTEREST_MAX_TAGS,
} from './feedTags';

const DEFAULT_SEARCH_LIMIT = 10;
const MODEL_PROVIDER = 'anthropic';

export type InterestAgentRunResult = {
  findingsAdded: number;
  summaryPostId: string | null;
  notifyRequested: boolean;
  summary: string;
};

const buildSystemPrompt = (
  interest: UserInterest,
  feedback: string[],
  currentTags: string[],
  maxTags: number,
): string => {
  const { post = true, notification = true } = interest.outputModes ?? {};
  const steps = [
    `1. Call set_interest_tags with the full set of daily.dev tag slugs that represent this interest (max ${maxTags}); it replaces the current set, so include the ones worth keeping and drop the rest.`,
    '2. Call search_daily_dev with a focused query derived from the interest.',
    '3. For each promising result, call score_finding to get a relevance/quality score.',
    '4. Call add_to_feed for the results worth surfacing.',
  ];
  if (post) {
    steps.push(
      `${steps.length + 1}. Call write_post once with a short markdown digest of what you found and why it matters.`,
    );
  }
  if (notification) {
    steps.push(
      `${steps.length + 1}. Call notify_user once so the user knows new content is ready.`,
    );
  }

  return [
    'You are the daily.dev Interest Agent. You hunt for content matching a single user interest, score it, and deliver it.',
    `The interest is: "${interest.query}".`,
    'Work only with daily.dev content in this run — do not invent URLs or reference external sources.',
    `FOMO threshold is ${interest.fomoThreshold ?? 0.5} (0 = surface everything, 1 = only the very best). Only add_to_feed items scoring at or above this threshold.`,
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

export const runInterestAgent = async ({
  con,
  logger,
  interest,
}: {
  con: DataSource;
  logger: FastifyBaseLogger;
  interest: UserInterest;
}): Promise<InterestAgentRunResult> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not configured for the interest agent',
    );
  }
  if (!interest.sourceId) {
    throw new Error('interest is missing a provisioned source');
  }

  const modelId = process.env.INTEREST_AGENT_MODEL || 'claude-opus-4-8';
  const agentDir = await mkdtemp(join(tmpdir(), 'interest-agent-'));

  const authStorage = AuthStorage.create(join(agentDir, 'auth.json'));
  authStorage.setRuntimeApiKey(MODEL_PROVIDER, apiKey);
  const modelRegistry = ModelRegistry.inMemory(authStorage);
  const model =
    modelRegistry.find(MODEL_PROVIDER, modelId) ??
    (await modelRegistry.getAvailable()).find(
      (candidate) => candidate.provider === MODEL_PROVIDER,
    );
  if (!model) {
    throw new Error(
      `interest agent model not found: ${MODEL_PROVIDER}/${modelId}`,
    );
  }

  const state: InterestAgentRunResult = {
    findingsAdded: 0,
    summaryPostId: null,
    notifyRequested: false,
    summary: '',
  };

  const scores = new Map<string, number>();
  const addedPostIds = new Set<string>();

  const registerTools = (pi: ExtensionAPI) => {
    pi.registerTool({
      name: 'search_daily_dev',
      label: 'Search daily.dev',
      description:
        'Search daily.dev for posts matching a query. Returns candidate posts with their ids and titles.',
      parameters: Type.Object({
        query: Type.String(),
        limit: Type.Optional(Type.Number()),
      }),
      execute: async (_id, params) => {
        const response: SearchResponse = await mimirClient.search(
          new SearchRequest({
            query: params.query,
            limit: params.limit ?? DEFAULT_SEARCH_LIMIT,
          }),
        );
        const postIds = response.result
          .map((item) => item.postId)
          .filter(Boolean);
        const posts = postIds.length
          ? await con.getRepository(Post).find({
              select: ['id', 'title'],
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
        }));
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
        'Score a single daily.dev post for relevance and quality. Returns a score between 0 and 1.',
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
        "Add a scored post to the interest's feed as a finding. Provide a short rationale.",
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
            status: InterestFindingStatus.Surfaced,
          })
          .orUpdate(['score', 'rationale', 'status'], ['interestId', 'postId'])
          .execute();
        addedPostIds.add(params.postId);
        state.findingsAdded += 1;
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
        "Write a short markdown digest post summarizing the findings. Hosted in the interest's source.",
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
      name: 'notify_user',
      label: 'Notify user',
      description:
        'Signal that new content is available for this interest. Call after write_post.',
      parameters: Type.Object({}),
      execute: async () => {
        state.notifyRequested = true;
        return {
          content: [{ type: 'text', text: JSON.stringify({ queued: true }) }],
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

  const activeTools = [
    'set_interest_tags',
    'search_daily_dev',
    'score_finding',
    'add_to_feed',
  ];
  if (interest.outputModes?.post ?? true) {
    activeTools.push('write_post');
  }
  if (interest.outputModes?.notification ?? true) {
    activeTools.push('notify_user');
  }

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

  try {
    await session.prompt(
      `Hunt daily.dev for content matching the interest "${interest.query}" and deliver it now.`,
    );
  } finally {
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

  state.summary = `Added ${state.findingsAdded} finding(s)${
    state.summaryPostId ? ', wrote a summary post' : ''
  }${state.notifyRequested ? ', notified the user' : ''}.`;

  logger.info(
    { interestId: interest.id, ...state },
    'interest agent run complete',
  );

  return state;
};
