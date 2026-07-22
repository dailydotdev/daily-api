import type { FastifyBaseLogger } from 'fastify';
import { anthropicClient } from '../../integrations/anthropic/client';
import type { AnthropicResponse } from '../../integrations/anthropic/types';
import type { UserInterest } from '../../entity/UserInterest';

export type DiscoveredUrl = {
  url: string;
  title: string;
  rationale: string;
  score: number;
};

const DEFAULT_DISCOVERY_LIMIT = 5;
const WEB_SEARCH_TOOL_TYPE =
  process.env.INTEREST_AGENT_WEB_SEARCH_TOOL || 'web_search_20250305';

const extractJsonArray = (text: string): string => {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  return start !== -1 && end !== -1 ? text.slice(start, end + 1) : '[]';
};

const isHttpUrl = (value: unknown): value is string =>
  typeof value === 'string' && /^https?:\/\//i.test(value);

const isDailyDevUrl = (value: string): boolean => {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === 'daily.dev' || host.endsWith('.daily.dev');
  } catch {
    return false;
  }
};

export const discoverExternalUrls = async ({
  interest,
  query,
  limit,
  logger,
}: {
  interest: Pick<UserInterest, 'id' | 'query'>;
  query: string;
  limit?: number;
  logger: FastifyBaseLogger;
}): Promise<DiscoveredUrl[]> => {
  const log = logger.child({ provider: 'interest agent' });
  const max = Math.max(1, Math.min(limit ?? DEFAULT_DISCOVERY_LIMIT, 10));

  const webTool: Record<string, unknown> = {
    type: WEB_SEARCH_TOOL_TYPE,
    name: 'web_search',
    max_uses: max,
  };

  const system = [
    'You are the daily.dev Interest Agent external scout.',
    'Use the web_search tool to find high-quality, recent content that genuinely matches the user interest.',
    'Prefer articles, docs, and notable repositories. Do not return daily.dev URLs.',
    'Be strict: only include results that are genuinely about the interest.',
    `Return at most ${max} results.`,
    'Reply with ONLY a JSON array, no prose: ' +
      '[{"url": string, "title": string, "rationale": short string, "score": number 0-1 for how well it matches the interest}].',
    'If nothing good is found, reply with [].',
  ].join('\n');

  let response: AnthropicResponse;
  try {
    response = await anthropicClient.createMessage({
      model: process.env.INTEREST_AGENT_MODEL || 'claude-opus-4-8',
      max_tokens: 4096,
      system,
      messages: [
        {
          role: 'user',
          content: `Interest: "${interest.query}".\nSearch query: "${query}".\nFind matching content now.`,
        },
      ],
      tools: [webTool],
    });
  } catch (err) {
    log.warn(
      { interestId: interest.id, query, err },
      'interest discovery failed',
    );
    return [];
  }

  const text = (response.content as Array<{ type?: string; text?: string }>)
    .map((block) => (block?.type === 'text' ? (block.text ?? '') : ''))
    .filter(Boolean)
    .join('\n')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonArray(text));
  } catch {
    log.warn(
      { interestId: interest.id, query },
      'interest discovery parse failed',
    );
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const seen = new Set<string>();
  const results: DiscoveredUrl[] = [];
  for (const item of parsed as Array<Record<string, unknown>>) {
    if (
      !isHttpUrl(item?.url) ||
      seen.has(item.url) ||
      isDailyDevUrl(item.url)
    ) {
      continue;
    }
    seen.add(item.url);
    results.push({
      url: item.url,
      title: typeof item.title === 'string' ? item.title : '',
      rationale:
        typeof item.rationale === 'string'
          ? item.rationale
          : 'Discovered on the web for this interest',
      score: typeof item.score === 'number' ? item.score : 0,
    });
    if (results.length >= max) {
      break;
    }
  }

  log.info(
    { interestId: interest.id, query, discovered: results.length },
    'interest discovery complete',
  );
  return results;
};
