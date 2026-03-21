import type { PostContentQuality } from '../../entity/posts/Post';
import type { PostRelation } from '../../entity/posts/PostRelation';
import { ONE_DAY_IN_SECONDS } from '../constants';
import type {
  CurrentHighlight,
  HighlightCandidate,
  HighlightPost,
  HighlightQualitySummary,
  HighlightSnapshotItem,
  HighlightSyncItem,
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

const toPreliminaryScore = ({
  post,
  horizonStart,
  referenceTime,
}: {
  post: HighlightPost;
  horizonStart: Date;
  referenceTime: Date;
}): number => {
  const ageSeconds = Math.max(
    1,
    (referenceTime.getTime() - post.createdAt.getTime()) / 1000,
  );
  const horizonSeconds = Math.max(
    ONE_DAY_IN_SECONDS,
    (referenceTime.getTime() - horizonStart.getTime()) / 1000,
  );
  const recency = Math.max(0.15, 1 - ageSeconds / horizonSeconds);
  const engagement = post.upvotes + post.comments * 2 + post.views / 200;
  const curationBoost = post.contentCuration.some((value) =>
    ['news', 'release', 'milestone', 'leak', 'drama'].includes(value),
  )
    ? 5
    : 0;
  const quality = toQualitySummary(post.contentQuality || {});
  const penalty =
    (quality.clickbaitProbability || 0) * 5 +
    (quality.selfPromotionScore || 0) * 3;

  return Number((engagement * recency + curationBoost - penalty).toFixed(3));
};

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
  referenceTime,
}: {
  posts: HighlightPost[];
  relations: PostRelation[];
  horizonStart: Date;
  referenceTime: Date;
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
        relatedItemsCount:
          memberPosts.filter((post) => post.id !== canonicalPostId).length || 1,
        contentCuration: canonicalPost.contentCuration || [],
        quality: toQualitySummary(canonicalPost.contentQuality || {}),
        preliminaryScore: toPreliminaryScore({
          post: canonicalPost,
          horizonStart,
          referenceTime,
        }),
      };
    })
    .filter((candidate) => candidate.lastActivityAt >= horizonStart)
    .sort((left, right) => right.preliminaryScore - left.preliminaryScore);
};

export const toHighlightSnapshotItem = (
  item: Pick<
    CurrentHighlight,
    'postId' | 'headline' | 'highlightedAt' | 'significanceLabel' | 'reason'
  >,
): HighlightSnapshotItem => ({
  postId: item.postId,
  headline: item.headline,
  highlightedAt: item.highlightedAt,
  significanceLabel: item.significanceLabel,
  reason: item.reason,
});

export const canonicalizeCurrentHighlights = ({
  highlights,
  relations,
  posts,
}: {
  highlights: HighlightSnapshotItem[];
  relations: PostRelation[];
  posts: HighlightPost[];
}): HighlightSyncItem[] => {
  const postsById = new Map(posts.map((post) => [post.id, post]));
  const collectionByChildId = buildCollectionByChildId(
    relations,
    new Set(postsById.keys()),
  );
  const canonicalHighlights = new Map<string, HighlightSyncItem>();

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

    const headline =
      canonicalPostId === highlight.postId
        ? highlight.headline
        : canonicalPost.title || highlight.headline;

    canonicalHighlights.set(canonicalPostId, {
      postId: canonicalPostId,
      headline,
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
  item: HighlightSnapshotItem | HighlightSyncItem,
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
