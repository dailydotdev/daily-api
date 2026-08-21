import type { FastifyBaseLogger } from 'fastify';
import { agentAnthropicClient } from '../../integrations/anthropic/client';
import type { UserInterest } from '../../entity/UserInterest';

export const generateInterestTitle = async ({
  interest,
  logger,
}: {
  interest: Pick<UserInterest, 'id' | 'query'>;
  logger: FastifyBaseLogger;
}): Promise<string | null> => {
  const log = logger.child({ provider: 'interest agent' });

  const system = [
    'You name a content-hunting agent that tracks one user interest.',
    'Given the user prompt that spawned it, reply with a short, user-friendly display name for the agent.',
    'At most 6 words, Title Case, no surrounding quotes and no trailing punctuation.',
    'Reply with the name only, nothing else.',
  ].join('\n');

  try {
    const response = await agentAnthropicClient.createMessage({
      model: process.env.INTEREST_TITLE_MODEL || 'claude-haiku-4-5',
      max_tokens: 30,
      system,
      messages: [{ role: 'user', content: interest.query }],
    });

    const [first] = response.content as Array<{ type?: string; text?: string }>;
    const title =
      first?.type === 'text' ? first.text?.trim().split('\n')[0]?.trim() : null;

    return title || null;
  } catch (err) {
    log.warn(
      { interestId: interest.id, err },
      'interest title generation failed',
    );
    return null;
  }
};
