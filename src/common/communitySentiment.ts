import { ValidationError } from 'apollo-server-errors';
import type { FastifyBaseLogger } from 'fastify';
import type { PostCommunitySentiment } from '../entity/posts/Post';
import {
  communitySentimentDiscussionsSchema,
  communitySentimentPayloadSchema,
} from './schema/communitySentiment';

export const mapCommunitySentimentPayload = ({
  communitySentiment,
  discussions,
}: {
  communitySentiment?: unknown;
  discussions?: unknown;
}): PostCommunitySentiment | undefined => {
  if (communitySentiment === undefined || communitySentiment === null) {
    return undefined;
  }

  const takeResult =
    communitySentimentPayloadSchema.safeParse(communitySentiment);
  if (!takeResult.success) {
    throw new ValidationError(
      JSON.stringify({
        communitySentiment: takeResult.error.flatten().fieldErrors,
      }),
    );
  }

  const discussionsResult = communitySentimentDiscussionsSchema.safeParse(
    discussions ?? [],
  );
  if (!discussionsResult.success) {
    throw new ValidationError(
      JSON.stringify({
        discussions: discussionsResult.error.flatten().fieldErrors,
      }),
    );
  }

  const take = takeResult.data;

  return {
    breakdown: take.breakdown,
    tldr: take.tldr,
    postCount: take.post_count,
    sources: take.sources ?? [],
    pros: take.pros ?? [],
    cons: take.cons ?? [],
    bySource: (take.by_source ?? []).map(({ source, lean, note, url }) => ({
      source,
      lean,
      note: note ?? '',
      url: url ?? undefined,
    })),
    hottestDebate: take.hottest_debate ?? undefined,
    openQuestions: take.open_questions ?? [],
    highlights: (take.highlights ?? []).map(
      ({ quote, author, source, url, metrics }) => ({
        quote,
        author: author ?? '',
        source,
        url: url ?? '',
        metrics: metrics
          ? {
              points: metrics.points ?? undefined,
              replies: metrics.replies ?? undefined,
              likes: metrics.likes ?? undefined,
            }
          : undefined,
      }),
    ),
    discussions: discussionsResult.data.flatMap(
      ({ provider, url, points, comments_count }) =>
        provider && url
          ? [
              {
                provider,
                url,
                points: points ?? 0,
                commentsCount: comments_count ?? 0,
              },
            ]
          : [],
    ),
    updatedAt: new Date().toISOString(),
  };
};

export const tryMapCommunitySentimentPayload = ({
  logger,
  communitySentiment,
  discussions,
}: {
  logger: FastifyBaseLogger;
  communitySentiment?: unknown;
  discussions?: unknown;
}): PostCommunitySentiment | undefined => {
  try {
    return mapCommunitySentimentPayload({ communitySentiment, discussions });
  } catch (err) {
    logger.warn(
      { err },
      'invalid community sentiment payload, skipping sentiment update',
    );
    return undefined;
  }
};
