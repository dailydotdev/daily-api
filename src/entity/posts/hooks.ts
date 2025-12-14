import { DataSource, DeepPartial, EntityManager } from 'typeorm';
import { createHash } from 'node:crypto';
import { checkWithVordr, VordrFilterType } from '../../common/vordr';
import { logger } from '../../logger';
import { Post, PostType } from './Post';
import { SharePost } from './SharePost';
import { FreeformPost } from './FreeformPost';
import { FastifyRequest } from 'fastify';

interface PreparePostContext {
  con: DataSource | EntityManager;
  userId?: string;
  req?: Pick<FastifyRequest, 'ip'>;
}

/**
 * Apply Vordr filtering hook to check if post should be shadow banned
 */
export const applyVordrHook = async <T extends DeepPartial<Post>>(
  post: T,
  context: PreparePostContext,
): Promise<T> => {
  const postContent = (post as DeepPartial<FreeformPost>).content; // Some post types have content
  const shouldVordr = await checkWithVordr(
    {
      id: post.id || 'new-post',
      type: VordrFilterType.Post,
      title: post.title || undefined,
      content: postContent,
    },
    context,
  );

  if (shouldVordr) {
    return {
      ...post,
      banned: true,
      showOnFeed: false,
      flags: {
        ...post.flags,
        vordr: true,
        banned: true,
        showOnFeed: false,
      },
    };
  }

  return post;
};

/**
 * Apply Vordr filtering hook for post updates
 */
export const applyVordrHookForUpdate = async <T extends DeepPartial<Post>>(
  updates: T,
  existingPost: Pick<Post, 'id' | 'flags'>,
  context: PreparePostContext,
): Promise<T> => {
  // If post is already vordr'd, don't check again
  if (existingPost.flags?.vordr) {
    return updates;
  }

  // Check content with existing checkWithVordr if we have userId
  const updatesContent = (updates as DeepPartial<FreeformPost>).content; // Some post types have content
  const shouldVordr = await checkWithVordr(
    {
      id: existingPost.id,
      type: VordrFilterType.Post,
      title: updates.title || undefined,
      content: updatesContent,
    },
    context,
  );

  if (shouldVordr) {
    logger.info({ postId: existingPost.id }, 'Post will be vordr on update');

    return {
      ...updates,
      showOnFeed: false,
      metadataChangedAt: new Date(),
      flags: {
        ...updates.flags,
        vordr: true,
        showOnFeed: false,
      },
    };
  }

  return updates;
};

/**
 * Remove special characters for deduplication purposes while preserving
 * letters from all languages.
 * Removes punctuation, symbols, emojis, but keeps Unicode letters and digits.
 * This is more aggressive than the general removeSpecialCharacters function
 * and is specifically designed for content deduplication.
 */
export const removeAllSpecialCharactersForDedup = (text: string): string => {
  // \p{L} matches any Unicode letter (including Chinese, Arabic, Cyrillic, etc.)
  return text.replace(/[^\p{L}]/gu, '');
};

/**
 * Normalize content for deduplication by making it lowercase,
 * trimming whitespace, and removing ALL special characters including emojis
 */
export const normalizeContentForDeduplication = (content: string): string => {
  return removeAllSpecialCharactersForDedup(content.toLowerCase().trim());
};

/**
 * Generate SHA-256 hash from normalized content
 */
export const generateContentHash = (content: string): string => {
  const hash = createHash('sha256');
  hash.update(content);
  return hash.digest('hex');
};

/**
 * Generate deduplication key based on post type and content
 */
export const generateDeduplicationKey = async (
  post: DeepPartial<Post>,
  con: DataSource | EntityManager,
): Promise<string | undefined> => {
  if (!post.type || ![PostType.Share, PostType.Freeform].includes(post.type)) {
    return undefined;
  }

  // For shared posts, always use the sharedPostId
  if (
    post.type === PostType.Share &&
    (post as DeepPartial<SharePost>).sharedPostId
  ) {
    const sharedPost = await con.getRepository(Post).findOne({
      where: {
        id: (post as DeepPartial<SharePost>).sharedPostId,
      },
      select: ['flags'],
    });

    return (
      sharedPost?.flags.dedupKey ||
      (post as DeepPartial<SharePost>).sharedPostId
    );
  }

  // For freeform posts, generate hash from content or title
  if (post.type === PostType.Freeform) {
    const freeformPost = post as DeepPartial<FreeformPost>;

    // Priority 1: Use content if available and not empty after normalization
    if (freeformPost.content) {
      const normalizedContent = normalizeContentForDeduplication(
        freeformPost.content,
      );
      if (normalizedContent) {
        return generateContentHash(normalizedContent);
      }
    }

    // Priority 2: Use title if content is not available or empty after normalization
    if (post.title) {
      const normalizedTitle = normalizeContentForDeduplication(post.title);
      if (normalizedTitle) {
        return generateContentHash(normalizedTitle);
      }
    }
  }

  return undefined;
};

/**
 * Apply deduplication hook to add dedupKey to post flags
 */
export const applyDeduplicationHook = async <T extends DeepPartial<Post>>(
  post: T,
  con: DataSource | EntityManager,
): Promise<T> => {
  const dedupKey = await generateDeduplicationKey(post, con);
  if (dedupKey) {
    return {
      ...post,
      flags: {
        ...post.flags,
        dedupKey,
      },
      metadataChangedAt: new Date(),
    };
  }

  return post;
};

/**
 * Apply deduplication hook to add dedupKey to post flags for updates
 */
export const applyDeduplicationHookForUpdate = async <
  T extends DeepPartial<Post>,
>(
  post: T,
  existingPost: DeepPartial<Post>,
  con: DataSource | EntityManager,
): Promise<T> => {
  const dedupKey = await generateDeduplicationKey(
    { ...existingPost, ...post },
    con,
  );
  if (dedupKey !== undefined) {
    return {
      ...post,
      flags: {
        ...post.flags,
        dedupKey,
      },
      metadataChangedAt: new Date(),
    };
  }

  return post;
};
