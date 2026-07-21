import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
} from '@earendil-works/pi-coding-agent';
import type { DataSource } from 'typeorm';
import type { FastifyBaseLogger } from 'fastify';
import type { UserInterest } from '../../entity/UserInterest';
import { InterestFeedback } from '../../entity/InterestFeedback';
import { FeedTag } from '../../entity/FeedTag';
import { createInterestAgentModel } from './agentModel';

export type InterestRelevanceResult = {
  relevant: boolean;
  score: number;
  rationale?: string;
};

const extractJson = (text: string): string => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start !== -1 && end !== -1 ? text.slice(start, end + 1) : '{}';
};

export const evaluateInterestRelevance = async ({
  con,
  logger,
  interest,
  post,
}: {
  con: DataSource;
  logger: FastifyBaseLogger;
  interest: Pick<UserInterest, 'id' | 'query' | 'feedId' | 'lastRunSummary'>;
  post: { title?: string | null; summary?: string | null };
}): Promise<InterestRelevanceResult> => {
  const log = logger.child({ provider: 'interest agent' });

  try {
    const feedbackRows = await con.getRepository(InterestFeedback).find({
      select: ['text'],
      where: { interestId: interest.id },
      order: { createdAt: 'DESC' },
      take: 5,
    });
    const feedback = feedbackRows.map((row) => row.text).reverse();

    const tagRows = interest.feedId
      ? await con.getRepository(FeedTag).find({
          select: ['tag'],
          where: { feedId: interest.feedId },
        })
      : [];
    const tags = tagRows.map((row) => row.tag);

    const systemPrompt = [
      'You are the daily.dev Interest Agent relevance judge.',
      'Decide whether a single post is genuinely relevant to the user interest below.',
      `The interest is: "${interest.query}".`,
      tags.length
        ? `Topics/tags that represent this interest: ${tags.join(', ')}.`
        : null,
      feedback.length
        ? `Apply this user feedback:\n${feedback.map((text) => `- ${text}`).join('\n')}`
        : null,
      interest.lastRunSummary
        ? `Recap of the last run: ${interest.lastRunSummary}`
        : null,
      'Be strict: a well-written post about a different topic is NOT relevant.',
      'Reply with ONLY a JSON object: {"relevant": boolean, "score": number between 0 and 1 for how well it matches, "rationale": short string}.',
    ]
      .filter(Boolean)
      .join('\n');

    const { agentDir, authStorage, modelRegistry, model } =
      await createInterestAgentModel();

    const resourceLoader = new DefaultResourceLoader({
      cwd: agentDir,
      agentDir,
      systemPromptOverride: () => systemPrompt,
      appendSystemPromptOverride: () => [],
      extensionFactories: [],
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
      tools: [],
    });

    let text = '';
    const unsubscribe = session.subscribe((event) => {
      if (event.type === 'message_end') {
        const message = event.message as {
          role?: string;
          content?: { type?: string; text?: string }[];
        };
        if (message.role === 'assistant' && Array.isArray(message.content)) {
          text = message.content
            .map((part) => (typeof part?.text === 'string' ? part.text : ''))
            .filter(Boolean)
            .join('\n')
            .trim();
        }
      }
    });

    try {
      await session.prompt(
        [
          `Post title: ${post.title ?? ''}`,
          `Post summary: ${post.summary ?? ''}`,
          'Is this post genuinely relevant to the interest?',
        ].join('\n'),
      );
    } finally {
      unsubscribe();
      session.dispose();
    }

    const parsed = JSON.parse(
      extractJson(text),
    ) as Partial<InterestRelevanceResult>;
    const result: InterestRelevanceResult = {
      relevant: !!parsed.relevant,
      score: typeof parsed.score === 'number' ? parsed.score : 0,
      rationale: parsed.rationale,
    };
    log.info({ interestId: interest.id, ...result }, 'interest relevance eval');
    return result;
  } catch (err) {
    log.warn(
      { interestId: interest.id, err },
      'interest relevance eval failed',
    );
    return { relevant: false, score: 0 };
  }
};
