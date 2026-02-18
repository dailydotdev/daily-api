import * as he from 'he';
import {
  findAuthor,
  generateTitleHtml,
  mergeKeywords,
  parseReadTime,
  PostOrigin,
  PostType,
  UNKNOWN_SOURCE,
} from '../../entity';
import { parseDate } from '../../common';
import { markdown } from '../../common/markdown';
import {
  isTwitterSocialType,
  mapTwitterSocialPayload,
  normalizeTwitterHandle,
  resolveTwitterSourceId,
} from '../../common/twitterSocial';
import type { Data, FixDataProps, FixData } from './types';
import { getSourcePrivacy } from './shared';
import { resolveTwitterIngestionSourceId } from './socialTwitter/processing';
import { resolveYouTubeKeywords } from './videoYouTube/processing';

export const fixData = async ({
  logger,
  entityManager,
  data,
}: FixDataProps): Promise<FixData> => {
  const creatorTwitterFromExtra =
    data?.extra?.creator_twitter === '' || data?.extra?.creator_twitter === '@'
      ? undefined
      : data?.extra?.creator_twitter;

  const isSocialTwitter = isTwitterSocialType(data?.content_type);
  const twitterMapping = isSocialTwitter
    ? mapTwitterSocialPayload({ data })
    : undefined;
  const creatorTwitterFromAuthorUsername = normalizeTwitterHandle(
    data?.extra?.author_username,
  );
  const creatorTwitter =
    creatorTwitterFromExtra ||
    creatorTwitterFromAuthorUsername ||
    twitterMapping?.authorUsername;
  const resolvedTwitterSource =
    isSocialTwitter && (!data?.source_id || data?.source_id === UNKNOWN_SOURCE)
      ? await resolveTwitterSourceId({
          entityManager,
          authorUsername: twitterMapping?.authorUsername,
        })
      : undefined;
  const sourceId = isSocialTwitter
    ? resolveTwitterIngestionSourceId({
        sourceId: data?.source_id,
        resolvedTwitterSourceId: resolvedTwitterSource?.id,
        origin: data?.origin,
      })
    : data?.source_id;
  const showOnFeed = isSocialTwitter ? false : !data?.order;

  const authorId = await findAuthor(entityManager, creatorTwitter || undefined);
  const privacy = await getSourcePrivacy({
    logger,
    entityManager,
    data: {
      ...data,
      source_id: sourceId,
    },
  });

  const keywords = resolveYouTubeKeywords(data);

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

  const duration = data?.extra?.duration
    ? data?.extra?.duration / 60
    : undefined;
  const contentMeta: Data['meta'] = {
    ...(data?.meta || {}),
  };

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

  const contentType =
    (isTwitterSocialType(data?.content_type)
      ? PostType.SocialTwitter
      : (data?.content_type as PostType)) || PostType.Article;

  const fixedData: FixData['fixedData'] = {
    origin: data?.origin as PostOrigin,
    authorId,
    creatorTwitter,
    url: data?.url,
    canonicalUrl: data?.extra?.canonical_url || data?.url,
    image: data?.image,
    sourceId,
    title: data?.title && he.decode(data?.title),
    readTime: parseReadTime(data?.extra?.read_time || duration),
    publishedAt: parseDate(data?.published_at),
    metadataChangedAt: parseDate(data?.updated_at) || new Date(),
    tagsStr: allowedKeywords?.join(',') || null,
    private: privacy,
    sentAnalyticsReport: privacy || !authorId,
    summary: data?.extra?.summary,
    description: data?.extra?.description,
    siteTwitter: data?.extra?.site_twitter,
    toc: data?.extra?.toc,
    contentCuration: data?.extra?.content_curation,
    showOnFeed,
    flags: {
      private: privacy,
      showOnFeed,
      sentAnalyticsReport: privacy || !authorId,
    },
    yggdrasilId: data?.id,
    type: contentType,
    content: data?.extra?.content,
    contentHtml: data?.extra?.content
      ? markdown.render(data.extra.content)
      : undefined,
    videoId: data?.extra?.video_id,
    language: data?.language,
    subType: null,
    contentMeta,
    contentQuality: data?.content_quality || {},
    ...(twitterMapping?.fields
      ? {
          ...twitterMapping.fields,
          title: twitterMapping.fields.title ?? undefined,
          content: twitterMapping.fields.content ?? undefined,
          contentHtml: twitterMapping.fields.contentHtml ?? undefined,
          image: twitterMapping.fields.image ?? undefined,
          videoId: twitterMapping.fields.videoId ?? undefined,
        }
      : {}),
  };

  if (contentType === PostType.SocialTwitter) {
    fixedData.titleHtml = fixedData.title
      ? generateTitleHtml(fixedData.title, [])
      : null;
  }

  return {
    mergedKeywords,
    questions: data?.extra?.questions || [],
    content_type: contentType,
    smartTitle: data?.alt_title,
    twitterReference: twitterMapping?.reference,
    fixedData,
  };
};
