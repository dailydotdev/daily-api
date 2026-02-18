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
  authorName?: string | null;
  authorAvatar?: string | null;
}

export interface TwitterMappingResult {
  fields: TwitterMappedPostFields;
  reference?: TwitterReferencePost;
  authorUsername?: string;
  authorProfile?: TwitterAuthorProfile;
}

export interface TwitterReferenceUpsertParams {
  entityManager: EntityManager;
  reference: TwitterReferencePost;
  language?: string | null;
}

export interface TwitterAuthorProfile {
  handle?: string;
  name?: string;
  profileImage?: string;
}

export const buildTwitterCreatorMeta = (
  profile: TwitterAuthorProfile,
): { social_twitter: { creator: Record<string, string> } } | undefined => {
  const { handle, name, profileImage } = profile;
  if (!handle && !name && !profileImage) {
    return undefined;
  }

  return {
    social_twitter: {
      creator: {
        ...(handle ? { handle } : {}),
        ...(name ? { name } : {}),
        ...(profileImage ? { profile_image: profileImage } : {}),
      },
    },
  };
};

const normalizeTwitterHandleForTitle = (
  handle?: string | null,
): string | undefined => {
  if (!handle) {
    return undefined;
  }

  return handle.trim().replace(/^@+/, '') || undefined;
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
  const parsed = url?.trim();
  if (!parsed) {
    return undefined;
  }

  const match = parsed.match(/\/status\/(\d+)/i);
  return match?.[1];
};

const extractTwitterHandleFromUrl = (
  url?: string | null,
): string | undefined => {
  const parsed = url?.trim();
  if (!parsed) {
    return undefined;
  }

  const match = parsed.match(
    /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([^/?#]+)\/status\//i,
  );

  return normalizeTwitterHandleForTitle(match?.[1]);
};

const stripLeadingMentions = (text: string): string =>
  text.replace(/^(?:@\w+\s*)+/, '').trim();

const formatTwitterTitle = ({
  content,
}: {
  content?: string | null;
}): string | undefined => {
  const parsedContent = content?.trim() || undefined;
  const cleanContent = parsedContent
    ? stripLeadingMentions(parsedContent) || undefined
    : undefined;

  if (!cleanContent) {
    return undefined;
  }

  return cleanContent;
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

  const fallback = fallbackImage?.trim() || undefined;

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

  return fallbackVideoId?.trim() || undefined;
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
  const textParts = [rootContent?.trim()];
  const htmlParts = [rootContentHtml?.trim()];

  threadTweets?.forEach((tweet) => {
    const tweetContent = tweet?.content?.trim();
    const tweetHtml = tweet?.content_html?.trim();

    textParts.push(tweetContent);

    if (tweetHtml) {
      htmlParts.push(tweetHtml);
      return;
    }

    if (!tweetContent) {
      return;
    }

    htmlParts.push(markdown.render(tweetContent));
  });

  const content = textParts.filter(Boolean).join('\n\n');
  const contentHtml = htmlParts.filter(Boolean).join('\n');

  return {
    content: content.trim() || undefined,
    contentHtml: contentHtml.trim() || undefined,
  };
};

const buildTwitterReferenceUrl = (
  url?: string | null,
  tweetId?: string | null,
): string | undefined => {
  const parsedUrl = url?.trim();
  if (parsedUrl) {
    return parsedUrl;
  }

  const parsedTweetId = tweetId?.trim();
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
    title: reference?.content?.trim() || undefined,
    content: reference?.content?.trim() || undefined,
    contentHtml: reference?.content_html?.trim() || undefined,
    image: pickPrimaryImage(reference.media || []),
    videoId: pickPrimaryVideoId(reference.media || []),
    authorUsername: reference.author_username?.trim() || undefined,
    authorName: reference.author_name?.trim() || undefined,
    authorAvatar: reference.author_avatar?.trim() || undefined,
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
  const authorName = payload.extra?.author_name?.trim() || undefined;
  const authorProfileImage = payload.extra?.author_avatar?.trim() || undefined;
  const authorProfile =
    authorUsername || authorName || authorProfileImage
      ? {
          handle: authorUsername,
          name: authorName,
          profileImage: authorProfileImage,
        }
      : undefined;

  const rootContent =
    payload.extra?.content?.trim() || payload.title?.trim() || undefined;
  const rootContentHtml = payload.extra?.content_html?.trim() || undefined;
  const media = payload.extra?.media || [];

  const fields: TwitterMappedPostFields = {
    type: PostType.SocialTwitter,
    subType,
    title:
      formatTwitterTitle({
        content: rootContent,
      }) ?? null,
    content: null,
    contentHtml: null,
    image: pickPrimaryImage(media, payload.image) ?? null,
    videoId: pickPrimaryVideoId(media, payload.extra?.video_id) ?? null,
  };

  if (subType !== 'thread') {
    return { fields, reference, authorUsername, authorProfile };
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
    authorProfile,
  };
};

export const resolveTwitterSourceId = async ({
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

const buildReferencePostFields = async ({
  entityManager,
  reference,
  language,
}: {
  entityManager: EntityManager;
  reference: TwitterReferencePost;
  language?: string | null;
}) => {
  const title = reference.title || reference.content || undefined;
  const content = reference.content || undefined;
  const contentHtml =
    reference.contentHtml || (content ? markdown.render(content) : undefined);
  const visible = !!(title || content);
  const resolvedSource = await resolveTwitterSourceId({
    entityManager,
    authorUsername: reference.authorUsername,
  });
  const sourceId = resolvedSource?.id || UNKNOWN_SOURCE;
  const isPrivate = resolvedSource?.isPrivate ?? true;
  const contentMeta =
    buildTwitterCreatorMeta({
      handle: normalizeTwitterHandle(reference.authorUsername),
      name: reference.authorName || undefined,
      profileImage: reference.authorAvatar || undefined,
    }) ?? {};

  return {
    subType: 'tweet' as const,
    sourceId,
    creatorTwitter: reference.authorUsername ?? undefined,
    contentMeta,
    metadataChangedAt: new Date(),
    title,
    content,
    contentHtml,
    image: reference.image ?? undefined,
    videoId: reference.videoId ?? undefined,
    private: isPrivate,
    visible,
    language: language || 'en',
    flags: {
      private: isPrivate,
      visible,
      sentAnalyticsReport: true,
      showOnFeed: false,
    },
  };
};

export const upsertTwitterReferencedPost = async ({
  entityManager,
  reference,
  language,
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
    const fields = await buildReferencePostFields({
      entityManager,
      reference,
      language,
    });
    await entityManager.getRepository(Post).update(existingPost.id, fields);
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
      const fields = await buildReferencePostFields({
        entityManager,
        reference,
        language,
      });
      await entityManager
        .getRepository(Post)
        .update(existingByStatusId.id, fields);
      return existingByStatusId.id;
    }
  }

  const id = await generateShortId();
  const fields = await buildReferencePostFields({
    entityManager,
    reference,
    language,
  });

  const repository = entityManager.getRepository(SocialTwitterPost);

  const post = repository.create({
    id,
    shortId: id,
    ...fields,
    createdAt: fields.metadataChangedAt,
    url: referenceUrl,
    canonicalUrl: referenceUrl,
    visibleAt: fields.visible ? fields.metadataChangedAt : null,
    showOnFeed: false,
    origin: PostOrigin.Crawler,
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
