import { extractTwitterStatusId } from '../twitterSocial';
import { PostType, type PostContentQuality } from '../../entity/posts/Post';
import { PostRelation } from '../../entity/posts/PostRelation';
import { ONE_DAY_IN_SECONDS } from '../constants';
import type { ChannelHighlightCandidatePool } from './schema';
import type {
  HighlightBaselineItem,
  HighlightPost,
  HighlightStory,
} from './types';
import type {
  HighlightQualitySummary,
  HighlightStoryCandidate,
} from './evaluate';

const toLastActivityAt = (post: HighlightPost): Date => {
  const candidates = [
    post.createdAt?.getTime() || 0,
    post.metadataChangedAt?.getTime() || 0,
    post.statsUpdatedAt?.getTime() || 0,
  ];
  return new Date(Math.max(...candidates));
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

const getTwitterSocialMeta = (
  post: HighlightPost,
): Record<string, unknown> | null => {
  const socialTwitter = (post.contentMeta as Record<string, unknown> | null)
    ?.social_twitter;

  if (!socialTwitter || typeof socialTwitter !== 'object') {
    return null;
  }

  return socialTwitter as Record<string, unknown>;
};

const getTwitterReferenceStatusId = (
  post: HighlightPost,
): string | undefined => {
  const reference = getTwitterSocialMeta(post)?.reference;
  if (!reference || typeof reference !== 'object') {
    return undefined;
  }

  const referenceRecord = reference as Record<string, unknown>;
  const tweetId =
    typeof referenceRecord.tweet_id === 'string'
      ? referenceRecord.tweet_id.trim()
      : undefined;

  if (tweetId) {
    return tweetId;
  }

  const referenceUrl =
    typeof referenceRecord.url === 'string' ? referenceRecord.url : undefined;
  return extractTwitterStatusId(referenceUrl);
};

const getTwitterRootStatusId = (post: HighlightPost): string | undefined => {
  const socialMeta = getTwitterSocialMeta(post);
  const tweetId =
    typeof socialMeta?.tweet_id === 'string' ? socialMeta.tweet_id.trim() : '';

  if (tweetId) {
    return tweetId;
  }

  return extractTwitterStatusId(post.canonicalUrl || post.url);
};

const getTwitterStoryKey = (post: HighlightPost): string | null => {
  if (post.type !== PostType.SocialTwitter) {
    return null;
  }

  const referenceStatusId = getTwitterReferenceStatusId(post);
  if (referenceStatusId) {
    return `twitter:${referenceStatusId}`;
  }

  const rootStatusId = getTwitterRootStatusId(post);
  if (rootStatusId) {
    return `twitter:${rootStatusId}`;
  }

  if (post.sharedPostId) {
    return `twitter:${post.sharedPostId}`;
  }

  return null;
};

export const getStoryKey = ({
  canonicalPost,
  collectionId,
}: {
  canonicalPost: HighlightPost;
  collectionId: string | null;
}): string => {
  if (collectionId) {
    return `collection:${collectionId}`;
  }

  const twitterStoryKey = getTwitterStoryKey(canonicalPost);
  if (twitterStoryKey) {
    return twitterStoryKey;
  }

  const canonicalUrl = canonicalPost.canonicalUrl || canonicalPost.url;
  if (canonicalUrl) {
    return `url:${canonicalUrl.toLowerCase().trim()}`;
  }

  return `post:${canonicalPost.id}`;
};

const toPreliminaryScore = ({
  story,
  horizonStart,
  referenceTime,
}: {
  story: Omit<HighlightStory, 'preliminaryScore'>;
  horizonStart: Date;
  referenceTime: Date;
}): number => {
  const ageSeconds = Math.max(
    1,
    (referenceTime.getTime() - story.canonicalPost.createdAt.getTime()) / 1000,
  );
  const horizonSeconds = Math.max(
    ONE_DAY_IN_SECONDS,
    (referenceTime.getTime() - horizonStart.getTime()) / 1000,
  );
  const recency = Math.max(0.15, 1 - ageSeconds / horizonSeconds);
  const engagement =
    story.canonicalPost.upvotes +
    story.canonicalPost.comments * 2 +
    story.canonicalPost.views / 200;
  const collectionBoost = story.collectionId ? 8 : 0;
  const curationBoost = story.canonicalPost.contentCuration.some((value) =>
    ['news', 'release', 'milestone', 'leak', 'drama'].includes(value),
  )
    ? 5
    : 0;
  const quality = toQualitySummary(story.canonicalPost.contentQuality || {});
  const penalty =
    (quality.clickbaitProbability || 0) * 5 +
    (quality.selfPromotionScore || 0) * 3;

  return Number(
    (engagement * recency + collectionBoost + curationBoost - penalty).toFixed(
      3,
    ),
  );
};

const selectCanonicalPost = (posts: HighlightPost[]): HighlightPost =>
  posts.slice().sort((left, right) => {
    const leftScore = left.upvotes + left.comments * 2 + left.views / 200;
    const rightScore = right.upvotes + right.comments * 2 + right.views / 200;
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    return right.createdAt.getTime() - left.createdAt.getTime();
  })[0];

// Highlights reason about stories, not raw posts. Collections are the primary
// story boundary, while social/twitter posts fall back to a stable tweet key.
export const buildStories = ({
  posts,
  relations,
  previousPool,
  horizonStart,
  referenceTime,
}: {
  posts: HighlightPost[];
  relations: PostRelation[];
  previousPool: ChannelHighlightCandidatePool;
  horizonStart: Date;
  referenceTime: Date;
}): HighlightStory[] => {
  const postsById = new Map(posts.map((post) => [post.id, post]));
  const previousStories = new Map(
    previousPool.stories.map((story) => [story.storyKey, story]),
  );
  const collectionByChildId = new Map<string, string>();
  const collectionIds = new Set<string>();
  const relationActivityByCollectionId = new Map<string, Date>();

  for (const relation of relations) {
    if (
      !postsById.has(relation.postId) ||
      !postsById.has(relation.relatedPostId)
    ) {
      continue;
    }

    collectionIds.add(relation.postId);
    collectionByChildId.set(relation.relatedPostId, relation.postId);
    const currentActivity = relationActivityByCollectionId.get(relation.postId);
    if (!currentActivity || relation.createdAt > currentActivity) {
      relationActivityByCollectionId.set(relation.postId, relation.createdAt);
    }
  }

  const groupedStories = new Map<string, HighlightPost[]>();
  const storyCollections = new Map<string, string | null>();

  for (const post of posts) {
    const collectionId =
      collectionByChildId.get(post.id) ||
      (collectionIds.has(post.id) ? post.id : null);
    const canonicalPost =
      collectionId && postsById.has(collectionId)
        ? postsById.get(collectionId)!
        : post;
    const storyKey = getStoryKey({
      canonicalPost,
      collectionId,
    });

    if (!groupedStories.has(storyKey)) {
      groupedStories.set(storyKey, []);
      storyCollections.set(storyKey, collectionId);
    }

    groupedStories.get(storyKey)!.push(post);
  }

  return [...groupedStories.entries()]
    .map(([storyKey, memberPosts]) => {
      const collectionId = storyCollections.get(storyKey) || null;
      const canonicalPost =
        collectionId && postsById.has(collectionId)
          ? postsById.get(collectionId)!
          : selectCanonicalPost(memberPosts);
      const firstSeenAt = memberPosts.reduce(
        (current, post) =>
          post.createdAt < current ? post.createdAt : current,
        canonicalPost.createdAt,
      );
      const postActivityAt = memberPosts.reduce((current, post) => {
        const lastActivityAt = toLastActivityAt(post);
        return lastActivityAt > current ? lastActivityAt : current;
      }, toLastActivityAt(canonicalPost));
      const relationActivityAt = collectionId
        ? relationActivityByCollectionId.get(collectionId)
        : null;
      const baseStory = {
        storyKey,
        canonicalPost,
        memberPosts,
        collectionId,
        firstSeenAt,
        lastSeenAt:
          relationActivityAt && relationActivityAt > postActivityAt
            ? relationActivityAt
            : postActivityAt,
        cached: previousStories.get(storyKey) || null,
      };

      return {
        ...baseStory,
        preliminaryScore: toPreliminaryScore({
          story: baseStory,
          horizonStart,
          referenceTime,
        }),
      };
    })
    .filter((story) => story.lastSeenAt >= horizonStart)
    .sort((left, right) => right.preliminaryScore - left.preliminaryScore);
};

export const toStoryCandidate = (
  story: HighlightStory,
): HighlightStoryCandidate => ({
  storyKey: story.storyKey,
  canonicalPostId: story.canonicalPost.id,
  collectionId: story.collectionId,
  memberPostIds: story.memberPosts.map((post) => post.id).sort(),
  title: story.canonicalPost.title || '',
  summary: story.canonicalPost.summary || '',
  type: story.canonicalPost.type,
  sourceId: story.canonicalPost.sourceId,
  createdAt: story.canonicalPost.createdAt.toISOString(),
  lastActivityAt: story.lastSeenAt.toISOString(),
  upvotes: story.canonicalPost.upvotes,
  comments: story.canonicalPost.comments,
  views: story.canonicalPost.views,
  contentCuration: story.canonicalPost.contentCuration || [],
  quality: toQualitySummary(story.canonicalPost.contentQuality || {}),
  preliminaryScore: story.preliminaryScore,
});

const toBaselineStoryKey = ({
  postId,
  storiesByPostId,
}: {
  postId: string;
  storiesByPostId: Map<string, HighlightStory>;
}): string => storiesByPostId.get(postId)?.storyKey || `post:${postId}`;

export const buildBaselineSnapshot = ({
  highlights,
  storiesByPostId,
}: {
  highlights: { postId: string; rank: number; headline: string }[];
  storiesByPostId: Map<string, HighlightStory>;
}): HighlightBaselineItem[] =>
  highlights.map((highlight) => ({
    postId: highlight.postId,
    rank: highlight.rank,
    headline: highlight.headline,
    storyKey: toBaselineStoryKey({
      postId: highlight.postId,
      storiesByPostId,
    }),
  }));
