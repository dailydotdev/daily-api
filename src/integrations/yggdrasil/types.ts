export type TimeSeriesParams = {
  resolution: '15m' | '1h' | '1d';
  entity?: string;
  groupId?: string;
  lookback?: string;
};

export type EntityTimeSeries = {
  t: number[];
  s: number[];
  v: number[];
  sv?: number[];
};

export type TimeSeriesResponse = {
  start: number;
  resolution_seconds: number;
  entities: Record<string, EntityTimeSeries>;
};

export type HighlightsParams = {
  entity?: string;
  groupId?: string;
  limit?: number;
  after?: string;
  orderBy?: 'score' | 'recency';
};

export type SentimentAnnotation = {
  entity: string;
  score: number;
  highlight_score: number;
};

export type XSearchAuthor = {
  id?: string;
  name?: string;
  handle?: string;
  avatar_url?: string;
};

export type XSearchMetrics = {
  like_count?: number;
  reply_count?: number;
  retweet_count?: number;
  quote_count?: number;
  bookmark_count?: number;
  impression_count?: number;
};

export type HighlightItem = {
  provider: string;
  external_item_id: string;
  url: string;
  text: string;
  author: XSearchAuthor | null;
  metrics: XSearchMetrics | null;
  created_at: string;
  sentiments: SentimentAnnotation[];
};

export type HighlightsResponse = {
  items: HighlightItem[];
  cursor: string | null;
};
