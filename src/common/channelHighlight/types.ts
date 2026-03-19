import type { Post } from '../../entity/posts/Post';
import type { ChannelHighlightRun } from '../../entity/ChannelHighlightRun';
import type { StoredHighlightStory } from './schema';

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

export type HighlightStory = {
  storyKey: string;
  canonicalPost: HighlightPost;
  memberPosts: HighlightPost[];
  collectionId: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  preliminaryScore: number;
  cached?: StoredHighlightStory | null;
};

export type HighlightBaselineItem = {
  postId: string;
  rank: number;
  headline: string;
  storyKey: string;
};

export type GenerateChannelHighlightResult = {
  run: ChannelHighlightRun;
  published: boolean;
};
