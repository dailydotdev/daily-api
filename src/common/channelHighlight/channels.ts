import type { HighlightPost } from './types';
import { buildStoryFamilies } from './storyFamilies';

type HighlightChannelResolverInput = {
  posts: HighlightPost[];
  relations: { postId: string; relatedPostId: string }[];
  fallbackPostIds: Map<string, string>;
};

export type HighlightChannelResolver = (postId: string) => string[];

const getPostChannels = (post: HighlightPost | undefined): string[] => {
  const contentMeta = post?.contentMeta as { channels?: unknown } | undefined;
  const channels = contentMeta?.channels;
  if (!Array.isArray(channels)) {
    return [];
  }

  return [
    ...new Set(
      channels.filter(
        (channel): channel is string => typeof channel === 'string',
      ),
    ),
  ].sort();
};

export const createHighlightChannelResolver = ({
  posts,
  relations,
  fallbackPostIds,
}: HighlightChannelResolverInput): HighlightChannelResolver => {
  const postsById = new Map(posts.map((post) => [post.id, post]));
  const shareToUnderlying = new Map(
    [...fallbackPostIds].map(([underlying, share]) => [share, underlying]),
  );
  const storyFamilies = buildStoryFamilies({ relations });

  return (postId) => {
    const underlyingPostId = shareToUnderlying.get(postId) || postId;
    const storyPostIds = storyFamilies.getFamilyPostIds(underlyingPostId);
    const channels = new Set<string>();

    for (const storyPostId of storyPostIds) {
      for (const channel of getPostChannels(postsById.get(storyPostId))) {
        channels.add(channel);
      }
    }

    return [...channels].sort();
  };
};
