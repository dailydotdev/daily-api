import type { PostContentQuality } from '../../entity/posts/Post';
import { toPostHighlightSignificanceLabel } from '../../entity/PostHighlight';
import type { PostRelation } from '../../entity/posts/PostRelation';
import type {
  CurrentHighlight,
  HighlightCandidate,
  HighlightItem,
  HighlightPost,
  HighlightQualitySummary,
} from './types';

const toLastActivityAt = (post: HighlightPost): Date => {
  const timestamps = [
    post.createdAt?.getTime() || 0,
    post.metadataChangedAt?.getTime() || 0,
    post.statsUpdatedAt?.getTime() || 0,
  ];

  return new Date(Math.max(...timestamps));
};

export const toQualitySummary = (
  quality: PostContentQuality,
): HighlightQualitySummary => ({
  clickbaitProbability:
    typeof quality?.is_clickbait_probability === 'number'
      ? quality.is_clickbait_probability
      : null,
  specificity: quality?.specificity || null,
  intent: quality?.intent || null,
  substanceDepth: quality?.substance_depth || null,
  titleContentAlignment: quality?.title_content_alignment || null,
  selfPromotionScore:
    typeof quality?.self_promotion_score === 'number'
      ? quality.self_promotion_score
      : null,
});

const buildCollectionByChildId = (
  relations: PostRelation[],
  availablePostIds: Set<string>,
): Map<string, string> => {
  const collectionByChildId = new Map<string, string>();

  for (const relation of relations) {
    if (
      !availablePostIds.has(relation.postId) ||
      !availablePostIds.has(relation.relatedPostId)
    ) {
      continue;
    }

    collectionByChildId.set(relation.relatedPostId, relation.postId);
  }

  return collectionByChildId;
};

type EngagementPost = {
  upvotes: number;
  comments: number;
  views: number;
};

const toEngagementScore = (post: EngagementPost): number =>
  post.upvotes + post.comments * 2 + post.views / 200;

const selectCanonicalPost = ({
  posts,
  canonicalPostId,
}: {
  posts: HighlightPost[];
  canonicalPostId: string;
}): HighlightPost => {
  const canonicalPost = posts.find((post) => post.id === canonicalPostId);
  if (canonicalPost) {
    return canonicalPost;
  }

  return [...posts].sort((left, right) => {
    const engagementDelta = toEngagementScore(right) - toEngagementScore(left);
    if (engagementDelta !== 0) {
      return engagementDelta;
    }

    return right.createdAt.getTime() - left.createdAt.getTime();
  })[0];
};

const groupPostsByCanonicalPostId = ({
  posts,
  collectionByChildId,
}: {
  posts: HighlightPost[];
  collectionByChildId: Map<string, string>;
}): Map<string, HighlightPost[]> => {
  const groupedPosts = new Map<string, HighlightPost[]>();

  for (const post of posts) {
    const canonicalPostId = collectionByChildId.get(post.id) || post.id;
    const members = groupedPosts.get(canonicalPostId) || [];
    members.push(post);
    groupedPosts.set(canonicalPostId, members);
  }

  return groupedPosts;
};

const buildCandidate = ({
  canonicalPostId,
  memberPosts,
}: {
  canonicalPostId: string;
  memberPosts: HighlightPost[];
}): HighlightCandidate => {
  const canonicalPost = selectCanonicalPost({
    posts: memberPosts,
    canonicalPostId,
  });
  const lastActivityAt = memberPosts.reduce((current, post) => {
    const activityAt = toLastActivityAt(post);
    return activityAt > current ? activityAt : current;
  }, toLastActivityAt(canonicalPost));

  return {
    postId: canonicalPost.id,
    title: canonicalPost.title || '',
    summary: canonicalPost.summary || '',
    createdAt: canonicalPost.createdAt,
    lastActivityAt,
    upvotes: canonicalPost.upvotes,
    comments: canonicalPost.comments,
    views: canonicalPost.views,
    relatedItemsCount: memberPosts.length,
    contentCuration: canonicalPost.contentCuration || [],
    quality: toQualitySummary(canonicalPost.contentQuality || {}),
  };
};

const compareCandidates = (
  left: HighlightCandidate,
  right: HighlightCandidate,
): number => {
  const activityDelta =
    right.lastActivityAt.getTime() - left.lastActivityAt.getTime();
  if (activityDelta !== 0) {
    return activityDelta;
  }

  const engagementDelta = toEngagementScore(right) - toEngagementScore(left);
  if (engagementDelta !== 0) {
    return engagementDelta;
  }

  return right.createdAt.getTime() - left.createdAt.getTime();
};

// API owns story canonicalization. If a post is part of a collection, the
// collection becomes the candidate Bragi sees and the live highlight should be
// upgraded in place without re-evaluation.
export const buildCandidates = ({
  posts,
  relations,
  horizonStart,
}: {
  posts: HighlightPost[];
  relations: PostRelation[];
  horizonStart: Date;
}): HighlightCandidate[] => {
  const availablePostIds = new Set(posts.map((post) => post.id));
  const collectionByChildId = buildCollectionByChildId(
    relations,
    availablePostIds,
  );
  const groupedPosts = groupPostsByCanonicalPostId({
    posts,
    collectionByChildId,
  });

  return [...groupedPosts.entries()]
    .map(([canonicalPostId, memberPosts]) =>
      buildCandidate({
        canonicalPostId,
        memberPosts,
      }),
    )
    .filter((candidate) => candidate.lastActivityAt >= horizonStart)
    .sort(compareCandidates);
};

export const toHighlightItem = (
  item: Pick<
    CurrentHighlight,
    'postId' | 'headline' | 'highlightedAt' | 'significance' | 'reason'
  >,
): HighlightItem => ({
  postId: item.postId,
  headline: item.headline,
  highlightedAt: item.highlightedAt,
  significanceLabel: toPostHighlightSignificanceLabel(item.significance),
  reason: item.reason,
});

export const canonicalizeCurrentHighlights = ({
  highlights,
  relations,
  posts,
}: {
  highlights: HighlightItem[];
  relations: PostRelation[];
  posts: HighlightPost[];
}): HighlightItem[] => {
  const postsById = new Map(posts.map((post) => [post.id, post]));
  const collectionByChildId = buildCollectionByChildId(
    relations,
    new Set(postsById.keys()),
  );
  const canonicalHighlights = new Map<string, HighlightItem>();

  for (const highlight of highlights) {
    const canonicalPostId =
      collectionByChildId.get(highlight.postId) || highlight.postId;
    const canonicalPost = postsById.get(canonicalPostId);

    if (!canonicalPost) {
      continue;
    }

    if (canonicalHighlights.has(canonicalPostId)) {
      continue;
    }

    canonicalHighlights.set(canonicalPostId, {
      postId: canonicalPostId,
      headline: highlight.headline,
      highlightedAt: highlight.highlightedAt,
      significanceLabel: highlight.significanceLabel,
      reason: highlight.reason,
    });
  }

  return [...canonicalHighlights.values()].sort(
    (left, right) =>
      right.highlightedAt.getTime() - left.highlightedAt.getTime(),
  );
};

const applyPublicShareFallback = <T extends { postId: string }>({
  items,
  inaccessiblePostIds,
  fallbackPostIds,
}: {
  items: T[];
  inaccessiblePostIds: Set<string>;
  fallbackPostIds: Map<string, string>;
}): T[] => {
  const mappedItems = new Map<string, T>();

  for (const item of items) {
    const fallbackPostId = fallbackPostIds.get(item.postId);
    if (!fallbackPostId && inaccessiblePostIds.has(item.postId)) {
      continue;
    }

    const postId = fallbackPostId || item.postId;
    if (mappedItems.has(postId)) {
      continue;
    }

    mappedItems.set(postId, {
      ...item,
      postId,
    });
  }

  return [...mappedItems.values()];
};

export const applyPublicShareFallbackToCandidates = ({
  candidates,
  inaccessiblePostIds,
  fallbackPostIds,
}: {
  candidates: HighlightCandidate[];
  inaccessiblePostIds: Set<string>;
  fallbackPostIds: Map<string, string>;
}): HighlightCandidate[] =>
  applyPublicShareFallback({
    items: candidates,
    inaccessiblePostIds,
    fallbackPostIds,
  }).sort(compareCandidates);

export const applyPublicShareFallbackToHighlights = ({
  highlights,
  inaccessiblePostIds,
  fallbackPostIds,
}: {
  highlights: HighlightItem[];
  inaccessiblePostIds: Set<string>;
  fallbackPostIds: Map<string, string>;
}): HighlightItem[] =>
  applyPublicShareFallback({
    items: highlights,
    inaccessiblePostIds,
    fallbackPostIds,
  }).sort(
    (left, right) =>
      right.highlightedAt.getTime() - left.highlightedAt.getTime(),
  );

export const toStoredSnapshotItem = (
  item: HighlightItem,
): {
  postId: string;
  headline: string;
  highlightedAt: string;
  significanceLabel: string | null;
  reason: string | null;
} => ({
  postId: item.postId,
  headline: item.headline,
  highlightedAt: item.highlightedAt.toISOString(),
  significanceLabel: item.significanceLabel,
  reason: item.reason,
});
