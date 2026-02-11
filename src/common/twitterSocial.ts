import { ValidationError } from 'apollo-server-errors';
import type { EntityManager } from 'typeorm';
import { generateShortId } from '../ids';
import { UNKNOWN_SOURCE } from '../entity/Source';
import { Post, PostOrigin, PostType } from '../entity/posts/Post';
import { SocialTwitterPost } from '../entity/posts/SocialTwitterPost';
import { markdown } from './markdown';
import {
  type TwitterSocialMedia,
  type TwitterSocialPayload,
  type TwitterSocialSubType,
  twitterSocialPayloadSchema,
} from './schema/socialTwitter';

export interface TwitterMappedPostFields {
  type: PostType.SocialTwitter;
  subType: TwitterSocialSubType;
  title?: string | null;
  content?: string | null;
  contentHtml?: string | null;
  image?: string | null;
  videoId?: string | null;
}

export interface TwitterReferencePost {
  subType: Extract<TwitterSocialSubType, 'quote' | 'repost'>;
  url: string;
  title?: string | null;
  content?: string | null;
  contentHtml?: string | null;
  image?: string | null;
  videoId?: string | null;
}

export interface TwitterMappingResult {
  fields: TwitterMappedPostFields;
  reference?: TwitterReferencePost;
  authorUsername?: string;
}

export interface TwitterReferenceUpsertParams {
  entityManager: EntityManager;
  reference: TwitterReferencePost;
  sourceId?: string | null;
  language?: string | null;
  isPrivate?: boolean;
}

const getStringOrUndefined = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length ? trimmedValue : undefined;
};

const normalizeTwitterHandleForTitle = (
  handle?: string | null,
): string | undefined => {
  const parsedHandle = getStringOrUndefined(handle);
  if (!parsedHandle) {
    return undefined;
  }

  return parsedHandle.replace(/^@+/, '');
};

export const normalizeTwitterHandle = (
  handle?: string | null,
): string | undefined => {
  const parsedHandle = normalizeTwitterHandleForTitle(handle);
  if (!parsedHandle) {
    return undefined;
  }

  return parsedHandle.toLowerCase();
};

export const extractTwitterStatusId = (
  url?: string | null,
): string | undefined => {
  const parsedUrl = getStringOrUndefined(url);
  if (!parsedUrl) {
    return undefined;
  }

  const match = parsedUrl.match(/\/status\/(\d+)/i);
  return match?.[1];
};

const extractTwitterHandleFromUrl = (
  url?: string | null,
): string | undefined => {
  const parsedUrl = getStringOrUndefined(url);
  if (!parsedUrl) {
    return undefined;
  }

  const match = parsedUrl.match(
    /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([^/?#]+)\/status\//i,
  );

  return normalizeTwitterHandleForTitle(match?.[1]);
};

const formatTwitterTitle = ({
  handle,
  content,
  subType,
}: {
  handle?: string;
  content?: string | null;
  subType?: TwitterSocialSubType;
}): string | undefined => {
  const parsedContent = getStringOrUndefined(content);

  if (!parsedContent && subType === 'repost' && handle) {
    return `@${handle}: reposted`;
  }

  if (!parsedContent) {
    return undefined;
  }

  if (!handle) {
    return parsedContent;
  }

  return `@${handle}: ${parsedContent}`;
};

const isImageMedia = (media: TwitterSocialMedia): boolean => {
  const type = media?.type?.toLowerCase();
  return type === 'image' || type === 'photo';
};

const isVideoMedia = (media: TwitterSocialMedia): boolean => {
  const type = media?.type?.toLowerCase();
  return type === 'video' || type === 'gif' || type === 'animated_gif';
};

const pickPrimaryImage = (
  media: TwitterSocialMedia[] = [],
  fallbackImage?: string | null,
): string | undefined => {
  const imageMedia = media.find((item) => isImageMedia(item) && item.url);

  if (imageMedia?.url) {
    return imageMedia.url;
  }

  return getStringOrUndefined(fallbackImage);
};

const pickPrimaryVideoId = (
  media: TwitterSocialMedia[] = [],
  fallbackVideoId?: string | null,
): string | undefined => {
  const videoMedia = media.find((item) => isVideoMedia(item) && item.url);

  if (videoMedia?.url) {
    return videoMedia.url;
  }

  return getStringOrUndefined(fallbackVideoId);
};

const buildThreadContent = ({
  rootContent,
  rootContentHtml,
  threadTweets,
}: {
  rootContent?: string | null;
  rootContentHtml?: string | null;
  threadTweets?: Array<{
    tweet_id?: string | null;
    content?: string | null;
    content_html?: string | null;
  } | null> | null;
}): Pick<TwitterMappedPostFields, 'content' | 'contentHtml'> => {
  const textParts = [getStringOrUndefined(rootContent)];
  const htmlParts = [getStringOrUndefined(rootContentHtml)];

  threadTweets?.forEach((tweet) => {
    textParts.push(getStringOrUndefined(tweet?.content));

    const htmlContent = getStringOrUndefined(tweet?.content_html);
    if (htmlContent) {
      htmlParts.push(htmlContent);
      return;
    }

    const textContent = getStringOrUndefined(tweet?.content);
    if (!textContent) {
      return;
    }

    htmlParts.push(markdown.render(textContent));
  });

  const content = textParts.filter(Boolean).join('\n\n');
  const contentHtml = htmlParts.filter(Boolean).join('\n');

  return {
    content: getStringOrUndefined(content),
    contentHtml: getStringOrUndefined(contentHtml),
  };
};

const buildTwitterReferenceUrl = (
  url?: string | null,
  tweetId?: string | null,
): string | undefined => {
  const parsedUrl = getStringOrUndefined(url);
  if (parsedUrl) {
    return parsedUrl;
  }

  const parsedTweetId = getStringOrUndefined(tweetId);
  if (!parsedTweetId) {
    return undefined;
  }

  return `https://x.com/i/web/status/${parsedTweetId}`;
};

const extractTwitterReference = (
  payload: TwitterSocialPayload,
): TwitterReferencePost | undefined => {
  const extra = payload.extra;
  if (!extra) {
    return undefined;
  }

  const repostSource =
    extra.reposted_tweet || extra.retweeted_tweet || undefined;
  const repostUrl = buildTwitterReferenceUrl(
    extra.reposted_tweet_url || extra.retweeted_tweet_url || repostSource?.url,
    extra.reposted_tweet_id ||
      extra.retweeted_tweet_id ||
      repostSource?.tweet_id,
  );

  if (repostSource || repostUrl) {
    return {
      subType: 'repost',
      url: repostUrl!,
      title: getStringOrUndefined(repostSource?.content),
      content: getStringOrUndefined(repostSource?.content),
      contentHtml: getStringOrUndefined(repostSource?.content_html),
      image: pickPrimaryImage(repostSource?.media || []),
      videoId: pickPrimaryVideoId(repostSource?.media || []),
    };
  }

  const quoteSource = extra.quoted_tweet || extra.referenced_tweet || undefined;
  const quoteUrl = buildTwitterReferenceUrl(
    extra.quoted_tweet_url || extra.referenced_tweet_url || quoteSource?.url,
    extra.quoted_tweet_id || extra.referenced_tweet_id || quoteSource?.tweet_id,
  );

  if (quoteSource || quoteUrl) {
    return {
      subType: 'quote',
      url: quoteUrl!,
      title: getStringOrUndefined(quoteSource?.content),
      content: getStringOrUndefined(quoteSource?.content),
      contentHtml: getStringOrUndefined(quoteSource?.content_html),
      image: pickPrimaryImage(quoteSource?.media || []),
      videoId: pickPrimaryVideoId(quoteSource?.media || []),
    };
  }

  return undefined;
};

const normalizeTwitterSubType = ({
  payload,
  reference,
}: {
  payload: TwitterSocialPayload;
  reference?: TwitterReferencePost;
}): TwitterSocialSubType => {
  const explicitType =
    payload.extra?.sub_type || payload.extra?.subtype || undefined;

  if (explicitType) {
    return explicitType === 'retweet' ? 'repost' : explicitType;
  }

  if (reference?.subType === 'repost') {
    return 'repost';
  }

  if (reference?.subType === 'quote') {
    return 'quote';
  }

  if (payload.extra?.is_thread || payload.extra?.thread_tweets?.length) {
    return 'thread';
  }

  if (payload.extra?.media?.length) {
    return 'media';
  }

  return 'tweet';
};

export const isTwitterSocialType = (contentType?: string): boolean =>
  contentType === PostType.SocialTwitter;

export const mapTwitterSocialPayload = ({
  data,
}: {
  data: unknown;
}): TwitterMappingResult => {
  const parseResult = twitterSocialPayloadSchema.safeParse(data);

  if (!parseResult.success) {
    throw new ValidationError(
      JSON.stringify({
        twitter: parseResult.error.flatten().fieldErrors,
      }),
    );
  }

  const payload = parseResult.data;
  const reference = extractTwitterReference(payload);
  const subType = normalizeTwitterSubType({ payload, reference });
  const authorHandle =
    normalizeTwitterHandleForTitle(payload.extra?.author_username) ||
    extractTwitterHandleFromUrl(payload.url);
  const authorUsername = normalizeTwitterHandle(authorHandle);

  const rootContent = getStringOrUndefined(
    payload.extra?.content || payload.title,
  );
  const rootContentHtml = getStringOrUndefined(payload.extra?.content_html);
  const media = payload.extra?.media || [];

  const fields: TwitterMappedPostFields = {
    type: PostType.SocialTwitter,
    subType,
    title:
      formatTwitterTitle({
        handle: authorHandle,
        content: rootContent,
        subType,
      }) ?? null,
    content: null,
    contentHtml: null,
    image: pickPrimaryImage(media, payload.image ?? undefined) ?? null,
    videoId: pickPrimaryVideoId(media, payload.extra?.video_id) ?? null,
  };

  if (subType !== 'thread') {
    return { fields, reference, authorUsername };
  }

  const { content, contentHtml } = buildThreadContent({
    rootContent,
    rootContentHtml,
    threadTweets: payload.extra?.thread_tweets,
  });

  return {
    fields: {
      ...fields,
      content: content ?? null,
      contentHtml: contentHtml ?? null,
    },
    reference,
    authorUsername,
  };
};

export const upsertTwitterReferencedPost = async ({
  entityManager,
  reference,
  sourceId,
  language,
  isPrivate = false,
}: TwitterReferenceUpsertParams): Promise<string | undefined> => {
  const referenceUrl = getStringOrUndefined(reference.url);
  if (!referenceUrl) {
    return undefined;
  }

  const referenceStatusId = extractTwitterStatusId(referenceUrl);

  const existingPost = await entityManager
    .createQueryBuilder()
    .from(Post, 'post')
    .select('post.id', 'id')
    .where('post.url = :url OR post."canonicalUrl" = :url', {
      url: referenceUrl,
    })
    .getRawOne<{ id: string }>();

  if (existingPost?.id) {
    return existingPost.id;
  }

  if (referenceStatusId) {
    const statusRegex = `/status/${referenceStatusId}(?:$|[/?#])`;
    const existingByStatusId = await entityManager
      .createQueryBuilder()
      .from(Post, 'post')
      .select('post.id', 'id')
      .where('post.url ~ :statusRegex OR post."canonicalUrl" ~ :statusRegex', {
        statusRegex,
      })
      .getRawOne<{ id: string }>();

    if (existingByStatusId?.id) {
      return existingByStatusId.id;
    }
  }

  const id = await generateShortId();
  const now = new Date();
  const title = getStringOrUndefined(reference.title || reference.content);
  const content = getStringOrUndefined(reference.content);
  const contentHtml =
    getStringOrUndefined(reference.contentHtml) ||
    (content ? markdown.render(content) : undefined);
  const visible = !!(title || content);
  const referenceSourceId = sourceId || UNKNOWN_SOURCE;

  const repository = entityManager.getRepository(SocialTwitterPost);

  const post = repository.create({
    id,
    shortId: id,
    subType: 'tweet',
    sourceId: referenceSourceId,
    createdAt: now,
    metadataChangedAt: now,
    title: title ?? null,
    content: content ?? null,
    contentHtml: contentHtml ?? null,
    image: reference.image ?? null,
    videoId: reference.videoId ?? null,
    url: referenceUrl,
    canonicalUrl: referenceUrl,
    private: isPrivate,
    visible,
    visibleAt: visible ? now : null,
    showOnFeed: false,
    origin: PostOrigin.Crawler,
    language: language || 'en',
    flags: {
      private: isPrivate,
      visible,
      sentAnalyticsReport: true,
      showOnFeed: false,
    },
    sentAnalyticsReport: true,
  });

  await repository.save(post);

  const insertedPost = await entityManager
    .createQueryBuilder()
    .from(Post, 'post')
    .select('post.id', 'id')
    .where('post.url = :url', { url: referenceUrl })
    .getRawOne<{ id: string }>();

  return insertedPost?.id;
};
