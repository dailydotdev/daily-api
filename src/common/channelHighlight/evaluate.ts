import type { PostType } from '../../entity/posts/Post';

export type HighlightQualitySummary = {
  clickbaitProbability: number | null;
  specificity: string | null;
  intent: string | null;
  substanceDepth: string | null;
  titleContentAlignment: string | null;
  selfPromotionScore: number | null;
};

export type HighlightStoryCandidate = {
  storyKey: string;
  canonicalPostId: string;
  collectionId: string | null;
  memberPostIds: string[];
  title: string;
  summary: string;
  type: PostType;
  sourceId: string;
  createdAt: string;
  lastActivityAt: string;
  upvotes: number;
  comments: number;
  views: number;
  contentCuration: string[];
  quality: HighlightQualitySummary;
  preliminaryScore: number;
};

export type EvaluateChannelHighlightsRequest = {
  channel: string;
  maxItems: number;
  currentHighlights: {
    postId: string;
    rank: number;
    headline: string;
    storyKey: string;
  }[];
  candidates: HighlightStoryCandidate[];
};

export type EvaluatedHighlightItem = {
  storyKey: string;
  postId: string;
  headline: string;
  significanceScore: number;
  significanceLabel: string;
  rank: number;
  reason: string;
};

export type EvaluateChannelHighlightsResponse = {
  items: EvaluatedHighlightItem[];
};

const clampScore = (score: number): number =>
  Math.max(0, Math.min(1, Number(score.toFixed(3))));

const toHeadline = (title: string): string => title.trim().slice(0, 200);

const toSignificance = (
  candidate: HighlightStoryCandidate,
): Pick<
  EvaluatedHighlightItem,
  'significanceLabel' | 'significanceScore' | 'reason'
> => {
  const curation = new Set(candidate.contentCuration);
  const isBreaking =
    curation.has('news') ||
    curation.has('release') ||
    curation.has('leak') ||
    curation.has('milestone') ||
    curation.has('drama');
  const strongEngagement =
    candidate.upvotes + candidate.comments * 2 + candidate.views / 250;
  const score = clampScore(
    candidate.preliminaryScore / 100 + (isBreaking ? 0.25 : 0),
  );

  if (score >= 0.8 || (isBreaking && strongEngagement >= 20)) {
    return {
      significanceLabel: 'breaking',
      significanceScore: score,
      reason: 'Mock evaluator marked the story as breaking',
    };
  }

  if (score >= 0.55) {
    return {
      significanceLabel: 'notable',
      significanceScore: score,
      reason: 'Mock evaluator marked the story as notable',
    };
  }

  return {
    significanceLabel: 'routine',
    significanceScore: score,
    reason: 'Mock evaluator marked the story as routine',
  };
};

// This is an API-side placeholder until the Bragi contract is finalized.
export const evaluateChannelHighlights = async ({
  maxItems,
  candidates,
}: EvaluateChannelHighlightsRequest): Promise<EvaluateChannelHighlightsResponse> => {
  const items = candidates
    .sort((left, right) => right.preliminaryScore - left.preliminaryScore)
    .slice(0, maxItems)
    .map((candidate, index) => {
      const significance = toSignificance(candidate);
      return {
        storyKey: candidate.storyKey,
        postId: candidate.canonicalPostId,
        headline: toHeadline(candidate.title),
        rank: index + 1,
        ...significance,
      };
    })
    .filter((item) => item.significanceLabel !== 'routine' || item.rank === 1);

  return {
    items,
  };
};
