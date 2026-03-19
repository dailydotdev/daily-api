import type { EvaluatedHighlightItem } from './evaluate';
import type { StoredHighlightStory } from './schema';
import type { HighlightBaselineItem, HighlightStory } from './types';

const arePostIdsEqual = (left: string[], right: string[]): boolean =>
  left.length === right.length &&
  left.every((postId, index) => postId === right[index]);

const hasCachedStoryChanged = (story: HighlightStory): boolean => {
  if (!story.cached) {
    return true;
  }

  const cachedMemberPostIds = [...story.cached.memberPostIds].sort();
  const storyMemberPostIds = story.memberPosts.map((post) => post.id).sort();

  return (
    story.cached.canonicalPostId !== story.canonicalPost.id ||
    !arePostIdsEqual(cachedMemberPostIds, storyMemberPostIds)
  );
};

// Reuse the prior LLM decision only when the underlying story is still the same
// story, the canonical post did not change, and no newer post/relation activity
// happened since that decision.
export const shouldReuseEvaluations = ({
  shortlist,
}: {
  shortlist: HighlightStory[];
}): boolean =>
  shortlist.length > 0 &&
  shortlist.every((story) => {
    if (
      !story.cached?.lastHeadline ||
      story.cached.lastSignificanceScore == null ||
      !story.cached.lastLlmEvaluatedAt
    ) {
      return false;
    }

    if (hasCachedStoryChanged(story)) {
      return false;
    }

    return (
      new Date(story.cached.lastLlmEvaluatedAt).getTime() >=
      story.lastSeenAt.getTime()
    );
  });

export const reuseEvaluations = ({
  shortlist,
  maxItems,
}: {
  shortlist: HighlightStory[];
  maxItems: number;
}): EvaluatedHighlightItem[] =>
  shortlist.slice(0, maxItems).map((story, index) => ({
    storyKey: story.storyKey,
    postId: story.canonicalPost.id,
    headline: story.cached?.lastHeadline || story.canonicalPost.title || '',
    significanceScore: story.cached?.lastSignificanceScore || 0,
    significanceLabel: story.cached?.lastSignificanceLabel || 'routine',
    rank: index + 1,
    reason: 'Reused cached evaluation',
  }));

export const toPoolStory = ({
  story,
  evaluation,
  evaluatedAt,
}: {
  story: HighlightStory;
  evaluation?: EvaluatedHighlightItem;
  evaluatedAt: Date;
}): StoredHighlightStory => ({
  storyKey: story.storyKey,
  canonicalPostId: story.canonicalPost.id,
  collectionId: story.collectionId,
  memberPostIds: story.memberPosts.map((post) => post.id).sort(),
  firstSeenAt: story.cached?.firstSeenAt || story.firstSeenAt.toISOString(),
  lastSeenAt: story.lastSeenAt.toISOString(),
  lastLlmEvaluatedAt: evaluation
    ? evaluatedAt.toISOString()
    : story.cached?.lastLlmEvaluatedAt || null,
  lastSignificanceScore:
    evaluation?.significanceScore ??
    story.cached?.lastSignificanceScore ??
    null,
  lastSignificanceLabel:
    evaluation?.significanceLabel ??
    story.cached?.lastSignificanceLabel ??
    null,
  lastHeadline: evaluation?.headline ?? story.cached?.lastHeadline ?? null,
  status: story.cached?.status || 'active',
});

const toItemSignature = (item: {
  storyKey: string;
  rank: number;
  postId: string;
}): string => `${item.storyKey}:${item.rank}:${item.postId}`;

// Publishing depends on the editorial surface changing in a user-visible way:
// a different story, a different canonical post for the same story, or a
// different headline for the same ranked set.
export const shouldPublish = ({
  baseline,
  internal,
}: {
  baseline: HighlightBaselineItem[];
  internal: EvaluatedHighlightItem[];
}): boolean => {
  if (!baseline.length) {
    return internal.length > 0;
  }

  if (!internal.length) {
    return false;
  }

  const baselineSignature = baseline.map(toItemSignature).join('|');
  const internalSignature = internal.map(toItemSignature).join('|');

  if (baselineSignature !== internalSignature) {
    return true;
  }

  const baselineHeadlines = baseline.map((item) => item.headline).join('|');
  const internalHeadlines = internal.map((item) => item.headline).join('|');
  return baselineHeadlines !== internalHeadlines;
};

export const compareSnapshots = ({
  baseline,
  internal,
}: {
  baseline: HighlightBaselineItem[];
  internal: EvaluatedHighlightItem[];
}) => {
  const baselineByStory = new Map(
    baseline.map((item) => [item.storyKey, item]),
  );
  const internalByStory = new Map(
    internal.map((item) => [item.storyKey, item]),
  );
  const overlap = [...internalByStory.keys()].filter((storyKey) =>
    baselineByStory.has(storyKey),
  );

  return {
    baselineCount: baseline.length,
    internalCount: internal.length,
    overlapCount: overlap.length,
    addedStoryKeys: [...internalByStory.keys()].filter(
      (storyKey) => !baselineByStory.has(storyKey),
    ),
    removedStoryKeys: [...baselineByStory.keys()].filter(
      (storyKey) => !internalByStory.has(storyKey),
    ),
    churnCount:
      [...internalByStory.keys()].filter(
        (storyKey) => !baselineByStory.has(storyKey),
      ).length +
      [...baselineByStory.keys()].filter(
        (storyKey) => !internalByStory.has(storyKey),
      ).length,
  };
};
