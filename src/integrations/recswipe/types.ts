export type DiscoverPostsParams = {
  prompt?: string;
  selectedTags?: string[];
  confirmedTags?: string[];
  likedTitles?: string[];
  excludeIds?: string[];
  saturatedTags?: string[];
  n?: number;
};

export type RawDiscoverPostsRequest = {
  prompt: string;
  selected_tags: string[];
  confirmed_tags: string[];
  liked_titles: string[];
  exclude_ids: string[];
  saturated_tags: string[];
  n: number;
};

export type DiscoverPostsRawItem = {
  post_id: string;
  title: string;
  summary: string;
  tags: string[];
  url: string;
  source_id: string;
};

export type DiscoverPostsResponse = {
  posts: DiscoverPostsRawItem[];
  sub_prompts: string[];
};

export type ExtractTagsParams = {
  prompt: string;
};

export type RawExtractTagsRequest = {
  prompt: string;
};

export type ExtractTagsResponse = {
  tags: string[];
};

export type RecommendTagsParams = {
  selectedTags: string[];
  n?: number;
};

export type RawRecommendTagsRequest = {
  selected_tags: string[];
  n: number;
};

export type RecommendedTagRaw = {
  tag: string;
  score: number;
};

export type RecommendTagsResponse = {
  recommended_tags: RecommendedTagRaw[];
};
