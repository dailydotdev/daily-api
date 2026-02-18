import {
  COMMUNITY_PICKS_SOURCE,
  findAuthor,
  generateTitleHtml,
  mergeKeywords,
  PostOrigin,
  PostType,
  UNKNOWN_SOURCE,
} from '../../../entity';
import type { Post } from '../../../entity';
import {
  mapTwitterSocialPayload,
  normalizeTwitterHandle,
  resolveTwitterSourceId,
} from '../../../common/twitterSocial';
import type { ProcessPostProps, ProcessedPost } from '../types';
import { buildCommonPostFields } from '../common';
import { getSourcePrivacy } from '../shared';

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

export const processSocialTwitter = async ({
  logger,
  entityManager,
  data,
}: ProcessPostProps): Promise<ProcessedPost> => {
  const twitterMapping = mapTwitterSocialPayload({ data });

  const creatorTwitterFromExtra =
    data?.extra?.creator_twitter === '' || data?.extra?.creator_twitter === '@'
      ? undefined
      : data?.extra?.creator_twitter;
  const creatorTwitterFromAuthorUsername = normalizeTwitterHandle(
    data?.extra?.author_username,
  );
  const creatorTwitter =
    creatorTwitterFromExtra ||
    creatorTwitterFromAuthorUsername ||
    twitterMapping?.authorUsername;

  const resolvedTwitterSource =
    !data?.source_id || data?.source_id === UNKNOWN_SOURCE
      ? await resolveTwitterSourceId({
          entityManager,
          authorUsername: twitterMapping?.authorUsername,
        })
      : undefined;
  const sourceId = resolveTwitterIngestionSourceId({
    sourceId: data?.source_id,
    resolvedTwitterSourceId: resolvedTwitterSource?.id,
    origin: data?.origin,
  });

  const authorId = await findAuthor(entityManager, creatorTwitter || undefined);
  const privacy = await getSourcePrivacy({
    logger,
    entityManager,
    data: {
      ...data,
      source_id: sourceId,
    },
  });

  const keywords = data?.extra?.keywords;
  const { allowedKeywords, mergedKeywords } = await mergeKeywords(
    entityManager,
    keywords,
  );

  if (allowedKeywords.length > 5) {
    logger.info(
      {
        url: data.url,
        keywords: allowedKeywords,
      },
      'created an article with more than 5 keywords',
    );
  }

  const contentMeta = { ...(data?.meta || {}) };
  const authorProfile = twitterMapping?.authorProfile;
  if (authorProfile) {
    contentMeta.social_twitter = {
      ...(contentMeta.social_twitter || {}),
      creator: {
        ...(contentMeta.social_twitter?.creator || {}),
        ...(authorProfile.handle ? { handle: authorProfile.handle } : {}),
        ...(authorProfile.name ? { name: authorProfile.name } : {}),
        ...(authorProfile.profileImage
          ? { profile_image: authorProfile.profileImage }
          : {}),
      },
    };
  }

  const fixedData = buildCommonPostFields({
    data,
    authorId,
    creatorTwitter,
    sourceId,
    privacy,
    showOnFeed: false,
    allowedKeywords,
    contentMeta,
    contentType: PostType.SocialTwitter,
  });

  if (twitterMapping?.fields) {
    Object.assign(fixedData, {
      ...twitterMapping.fields,
      title: twitterMapping.fields.title ?? undefined,
      content: twitterMapping.fields.content ?? undefined,
      contentHtml: twitterMapping.fields.contentHtml ?? undefined,
      image: twitterMapping.fields.image ?? undefined,
      videoId: twitterMapping.fields.videoId ?? undefined,
    });
  }

  fixedData.titleHtml = fixedData.title
    ? generateTitleHtml(fixedData.title, [])
    : null;

  return {
    contentType: PostType.SocialTwitter,
    fixedData,
    mergedKeywords,
    questions: data?.extra?.questions || [],
    smartTitle: data?.alt_title,
    twitterReference: twitterMapping?.reference,
    allowedUpdateFields: twitterAllowedFields,
  };
};
