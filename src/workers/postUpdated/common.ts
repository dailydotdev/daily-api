import * as he from 'he';
import {
  findAuthor,
  mergeKeywords,
  parseReadTime,
  PostOrigin,
  PostType,
} from '../../entity';
import { parseDate } from '../../common';
import { markdown } from '../../common/markdown';
import { normalizeTwitterHandle } from '../../common/twitterSocial';
import type { Data, FixedData, ProcessPostProps } from './types';
import { getSourcePrivacy } from './shared';

export const resolveCreatorTwitter = ({
  data,
}: {
  data: Data;
}): string | undefined => {
  const creatorTwitterFromExtra =
    data?.extra?.creator_twitter === '' || data?.extra?.creator_twitter === '@'
      ? undefined
      : data?.extra?.creator_twitter;

  const creatorTwitterFromAuthorUsername = normalizeTwitterHandle(
    data?.extra?.author_username,
  );

  return creatorTwitterFromExtra || creatorTwitterFromAuthorUsername;
};

export const resolveCommonDeps = async ({
  logger,
  entityManager,
  data,
  sourceId,
  keywords,
}: Pick<ProcessPostProps, 'logger' | 'entityManager'> & {
  data: Data;
  sourceId: string | undefined;
  keywords: string[] | undefined;
}) => {
  const creatorTwitter = resolveCreatorTwitter({ data });

  const authorId = await findAuthor(entityManager, creatorTwitter || undefined);
  const privacy = await getSourcePrivacy({
    logger,
    entityManager,
    data: {
      ...data,
      source_id: sourceId,
    },
  });

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

  return {
    creatorTwitter,
    authorId,
    privacy,
    allowedKeywords,
    mergedKeywords,
  };
};

export const buildCommonPostFields = ({
  data,
  authorId,
  creatorTwitter,
  sourceId,
  privacy,
  showOnFeed,
  allowedKeywords,
  contentMeta,
  contentType,
}: {
  data: Data;
  authorId: string | null | undefined;
  creatorTwitter: string | undefined;
  sourceId: string | undefined;
  privacy: boolean | undefined;
  showOnFeed: boolean;
  allowedKeywords: string[];
  contentMeta: Data['meta'];
  contentType: PostType;
}): FixedData => {
  const duration = data?.extra?.duration
    ? data?.extra?.duration / 60
    : undefined;

  return {
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
  };
};
