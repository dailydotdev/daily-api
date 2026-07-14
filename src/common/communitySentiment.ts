import { ValidationError } from 'apollo-server-errors';
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
    discussions: discussionsResult.data.map(
      ({ provider, url, points, comments_count }) => ({
        provider,
        url,
        points,
        commentsCount: comments_count,
      }),
    ),
    updatedAt: new Date().toISOString(),
  };
};
