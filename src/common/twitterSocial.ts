import { ValidationError } from 'apollo-server-errors';
import type { EntityManager } from 'typeorm';
import { generateShortId } from '../ids';
import { Source, SourceType, UNKNOWN_SOURCE } from '../entity/Source';
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
  authorUsername?: string | null;
}

export interface TwitterMappingResult {
  fields: TwitterMappedPostFields;
  reference?: TwitterReferencePost;
  authorUsername?: string;
}

export interface TwitterReferenceUpsertParams {
  entityManager: EntityManager;
  reference: TwitterReferencePost;
  language?: string | null;
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

const stripLeadingMentions = (text: string): string =>
  text.replace(/^(?:@\w+\s*)+/, '').trim();

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
  const cleanContent = parsedContent
    ? getStringOrUndefined(stripLeadingMentions(parsedContent))
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

const isTwitterProfileImage = (url?: string | null): boolean =>
  !!url && /pbs\.twimg\.com\/profile_images\//i.test(url);

const pickPrimaryImage = (
  media: TwitterSocialMedia[] = [],
  fallbackImage?: string | null,
): string | undefined => {
  const imageMedia = media.find((item) => isImageMedia(item) && item.url);

  if (imageMedia?.url) {
    return imageMedia.url;
  }

  const fallback = getStringOrUndefined(fallbackImage);

  if (isTwitterProfileImage(fallback)) {
    return undefined;
  }

  return fallback;
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
  if (!extra?.reference) {
    return undefined;
  }

  const reference = extra.reference;
  const referenceUrl = buildTwitterReferenceUrl(
    reference.url,
    reference.tweet_id,
  );

  if (!referenceUrl) {
    return undefined;
  }

  const explicitSubType = extra.sub_type || extra.subtype;
  const subType: 'repost' | 'quote' =
    explicitSubType === 'quote' ? 'quote' : 'repost';

  return {
    subType,
    url: referenceUrl,
    title: getStringOrUndefined(reference.title || reference.content),
    content: getStringOrUndefined(reference.content),
    contentHtml: getStringOrUndefined(reference.content_html),
    image: pickPrimaryImage(reference.media || []),
    videoId: pickPrimaryVideoId(reference.media || []),
    authorUsername: getStringOrUndefined(reference.author_username),
  };
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

const resolveSourceByTwitterUsername = async ({
  entityManager,
  authorUsername,
}: {
  entityManager: EntityManager;
  authorUsername?: string | null;
}): Promise<{ id: string; isPrivate: boolean } | undefined> => {
  if (!authorUsername) {
    return undefined;
  }

  const matchedSource = await entityManager
    .getRepository(Source)
    .createQueryBuilder('source')
    .select(['source.id', 'source.private'])
    .where('source.type = :type', { type: SourceType.Machine })
    .andWhere('LOWER(source.twitter) = :twitter', {
      twitter: authorUsername.toLowerCase(),
    })
    .getOne();

  if (!matchedSource) {
    return undefined;
  }

  return { id: matchedSource.id, isPrivate: matchedSource.private };
};

export const upsertTwitterReferencedPost = async ({
  entityManager,
  reference,
  language,
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
  const resolvedSource = await resolveSourceByTwitterUsername({
    entityManager,
    authorUsername: reference.authorUsername,
  });
  const referenceSourceId = resolvedSource?.id || UNKNOWN_SOURCE;
  const isPrivate = resolvedSource?.isPrivate ?? true;

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
