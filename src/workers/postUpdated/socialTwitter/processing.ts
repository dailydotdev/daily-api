import {
  COMMUNITY_PICKS_SOURCE,
  PostOrigin,
  UNKNOWN_SOURCE,
} from '../../../entity';
import type { Post } from '../../../entity';

export const twitterAllowedFields = [
  'canonicalUrl',
  'content',
  'contentCuration',
  'contentHtml',
  'contentMeta',
  'contentQuality',
  'creatorTwitter',
  'description',
  'image',
  'language',
  'metadataChangedAt',
  'origin',
  'private',
  'publishedAt',
  'readTime',
  'sentAnalyticsReport',
  'sharedPostId',
  'showOnFeed',
  'siteTwitter',
  'sourceId',
  'subType',
  'summary',
  'tagsStr',
  'title',
  'titleHtml',
  'translation',
  'type',
  'url',
  'videoId',
];

export const resolveTwitterIngestionSourceId = ({
  sourceId,
  resolvedTwitterSourceId,
  origin,
}: {
  sourceId?: string;
  resolvedTwitterSourceId?: string;
  origin?: string;
}): string => {
  const explicitSourceId =
    sourceId && sourceId !== UNKNOWN_SOURCE ? sourceId : undefined;

  if (explicitSourceId) {
    return explicitSourceId;
  }

  if (resolvedTwitterSourceId) {
    return resolvedTwitterSourceId;
  }

  if (origin === PostOrigin.UserGenerated) {
    return COMMUNITY_PICKS_SOURCE;
  }

  return UNKNOWN_SOURCE;
};

export const mergeTwitterContentMeta = ({
  databasePost,
  data,
}: {
  databasePost: Post;
  data: Partial<Post>;
}) => {
  const existingMeta = (databasePost.contentMeta ?? {}) as Record<
    string,
    unknown
  >;
  const incomingMeta = (data.contentMeta ?? {}) as Record<string, unknown>;
  const existingTwitter =
    (existingMeta.social_twitter as Record<string, unknown>) ?? {};
  const incomingTwitter =
    (incomingMeta.social_twitter as Record<string, unknown>) ?? {};

  return {
    ...existingMeta,
    ...incomingMeta,
    social_twitter: {
      ...existingTwitter,
      ...incomingTwitter,
      creator: {
        ...((existingTwitter.creator as Record<string, unknown>) ?? {}),
        ...((incomingTwitter.creator as Record<string, unknown>) ?? {}),
      },
    },
  };
};
