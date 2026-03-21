import type { Post } from '../../entity/posts/Post';
import type { ChannelHighlightRun } from '../../entity/ChannelHighlightRun';

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
  preliminaryScore: number;
};

export type CurrentHighlight = {
  id: string;
  postId: string;
  highlightedAt: Date;
  headline: string;
  significanceLabel: string | null;
  reason: string | null;
};

export type HighlightSnapshotItem = {
  postId: string;
  headline: string;
  highlightedAt: Date;
  significanceLabel: string | null;
  reason: string | null;
};

export type HighlightSyncItem = {
  postId: string;
  headline: string;
  highlightedAt: Date;
  significanceLabel: string | null;
  reason: string | null;
};

export type GenerateChannelHighlightResult = {
  run: ChannelHighlightRun;
  published: boolean;
};
