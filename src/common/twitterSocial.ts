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

const normalizeTwitterHandleForTitle = (
  handle?: string,
): string | undefined => {
  if (!handle) {
    return undefined;
  }

  return handle.replace(/^@+/, '');
};

export const normalizeTwitterHandle = (handle?: string): string | undefined => {
  const parsedHandle = normalizeTwitterHandleForTitle(handle);
  if (!parsedHandle) {
    return undefined;
  }

  return parsedHandle.toLowerCase();
};

export const extractTwitterStatusId = (url?: string): string | undefined => {
  if (!url) {
    return undefined;
  }

  const match = url.match(/\/status\/(\d+)/i);
  return match?.[1];
};

const extractTwitterHandleFromUrl = (url?: string): string | undefined => {
  if (!url) {
    return undefined;
  }

  const match = url.match(
    /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([^/?#]+)\/status\//i,
  );

  return normalizeTwitterHandleForTitle(match?.[1]);
};

const stripLeadingMentions = (text: string): string =>
  text.replace(/^(?:@\w+\s*)+/, '').trim();

const formatTwitterTitle = ({
  handle,
  content,
  subType,
}: {
  handle?: string;
  content?: string;
  subType?: TwitterSocialSubType;
}): string | undefined => {
  const cleanContent = content
    ? stripLeadingMentions(content) || undefined
    : undefined;

  if (!cleanContent && subType === 'repost' && handle) {
    return `@${handle}: reposted`;
  }

  if (!cleanContent) {
    return undefined;
  }

  if (!handle) {
    return cleanContent;
  }

  return `@${handle}: ${cleanContent}`;
};

const isImageMedia = (media: TwitterSocialMedia): boolean => {
  const type = media?.type?.toLowerCase();
  return type === 'image' || type === 'photo';
};

const isVideoMedia = (media: TwitterSocialMedia): boolean => {
  const type = media?.type?.toLowerCase();
  return type === 'video' || type === 'gif' || type === 'animated_gif';
};

const isTwitterProfileImage = (url?: string): boolean =>
  !!url && /pbs\.twimg\.com\/profile_images\//i.test(url);

const pickPrimaryImage = (
  media: TwitterSocialMedia[] = [],
  fallbackImage?: string,
): string | undefined => {
  const imageMedia = media.find((item) => isImageMedia(item) && item.url);

  if (imageMedia?.url) {
    return imageMedia.url;
  }

  if (isTwitterProfileImage(fallbackImage)) {
    return undefined;
  }

  return fallbackImage;
};

const pickPrimaryVideoId = (
  media: TwitterSocialMedia[] = [],
  fallbackVideoId?: string,
): string | undefined => {
  const videoMedia = media.find((item) => isVideoMedia(item) && item.url);

  if (videoMedia?.url) {
    return videoMedia.url;
  }

  return fallbackVideoId;
};

const buildThreadContent = ({
  rootContent,
  rootContentHtml,
  threadTweets,
}: {
  rootContent?: string;
  rootContentHtml?: string;
  threadTweets?: Array<{
    tweet_id?: string;
    content?: string;
    content_html?: string;
  } | null> | null;
}): Pick<TwitterMappedPostFields, 'content' | 'contentHtml'> => {
  const textParts = [rootContent];
  const htmlParts = [rootContentHtml];

  threadTweets?.forEach((tweet) => {
    textParts.push(tweet?.content);

    if (tweet?.content_html) {
      htmlParts.push(tweet.content_html);
      return;
    }

    if (!tweet?.content) {
      return;
    }

    htmlParts.push(markdown.render(tweet.content));
  });

  const content = textParts.filter(Boolean).join('\n\n');
  const contentHtml = htmlParts.filter(Boolean).join('\n');

  return {
    content: content.trim() || undefined,
    contentHtml: contentHtml.trim() || undefined,
  };
};

const buildTwitterReferenceUrl = (
  url?: string,
  tweetId?: string,
): string | undefined => {
  if (url) {
    return url;
  }

  if (!tweetId) {
    return undefined;
  }

  return `https://x.com/i/web/status/${tweetId}`;
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
      title: repostSource?.content,
      content: repostSource?.content,
      contentHtml: repostSource?.content_html,
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
      title: quoteSource?.content,
      content: quoteSource?.content,
      contentHtml: quoteSource?.content_html,
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

  const rootContent = payload.extra?.content || payload.title;
  const rootContentHtml = payload.extra?.content_html;
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
    image: pickPrimaryImage(media, payload.image) ?? null,
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
  const referenceUrl = reference.url?.trim() || undefined;
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
  const title = reference.title || reference.content || undefined;
  const content = reference.content || undefined;
  const contentHtml =
    reference.contentHtml || (content ? markdown.render(content) : undefined);
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
    title,
    content,
    contentHtml,
    image: reference.image ?? undefined,
    videoId: reference.videoId ?? undefined,
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
