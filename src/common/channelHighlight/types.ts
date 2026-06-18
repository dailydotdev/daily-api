import type { Post } from '../../entity/posts/Post';
import type { ChannelHighlightRun } from '../../entity/ChannelHighlightRun';
import type { HighlightSignificance } from './significance';

export type HighlightPost = Pick<
  Post,
  | 'id'
  | 'type'
  | 'title'
  | 'summary'
  | 'createdAt'
  | 'metadataChangedAt'
  | 'statsUpdatedAt'
  | 'upvotes'
  | 'comments'
  | 'views'
  | 'sourceId'
  | 'contentCuration'
  | 'contentQuality'
  | 'visible'
  | 'deleted'
  | 'banned'
  | 'showOnFeed'
  | 'contentMeta'
> & {
  url: string | null;
  canonicalUrl: string | null;
  sharedPostId?: string | null;
};

export type HighlightQualitySummary = {
  clickbaitProbability: number | null;
  specificity: string | null;
  intent: string | null;
  substanceDepth: string | null;
  titleContentAlignment: string | null;
  selfPromotionScore: number | null;
};

export type HighlightCandidate = {
  postId: string;
  title: string;
  summary: string;
  createdAt: Date;
  lastActivityAt: Date;
  upvotes: number;
  comments: number;
  views: number;
  relatedItemsCount: number;
  contentCuration: string[];
  quality: HighlightQualitySummary;
};

export type CurrentHighlight = {
  id: string;
  postId: string;
  highlightedAt: Date;
  headline: string;
  significance: HighlightSignificance;
  reason: string | null;
};

export type HighlightItem = {
  postId: string;
  headline: string;
  summary: string | null;
  highlightedAt: Date;
  significanceLabel: string | null;
  reason: string | null;
};

export type GenerateHighlightsResult = {
  runs: ChannelHighlightRun[];
  published: boolean;
};
