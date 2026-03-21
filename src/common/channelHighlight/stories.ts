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

const selectCanonicalPost = ({
  posts,
  canonicalPostId,
}: {
  posts: HighlightPost[];
  canonicalPostId: string;
}): HighlightPost =>
  posts.find((post) => post.id === canonicalPostId) ||
  posts.slice().sort((left, right) => {
    const leftScore = left.upvotes + left.comments * 2 + left.views / 200;
    const rightScore = right.upvotes + right.comments * 2 + right.views / 200;

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    return right.createdAt.getTime() - left.createdAt.getTime();
  })[0];

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
  const groupedPosts = new Map<string, HighlightPost[]>();

  for (const post of posts) {
    const canonicalPostId = collectionByChildId.get(post.id) || post.id;
    if (!groupedPosts.has(canonicalPostId)) {
      groupedPosts.set(canonicalPostId, []);
    }

    groupedPosts.get(canonicalPostId)!.push(post);
  }

  return [...groupedPosts.entries()]
    .map(([canonicalPostId, memberPosts]) => {
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
    })
    .filter((candidate) => candidate.lastActivityAt >= horizonStart)
    .sort((left, right) => {
      const activityDelta =
        right.lastActivityAt.getTime() - left.lastActivityAt.getTime();
      if (activityDelta !== 0) {
        return activityDelta;
      }

      const engagementDelta =
        right.upvotes +
        right.comments * 2 +
        right.views / 200 -
        (left.upvotes + left.comments * 2 + left.views / 200);
      if (engagementDelta !== 0) {
        return engagementDelta;
      }

      return right.createdAt.getTime() - left.createdAt.getTime();
    });
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
