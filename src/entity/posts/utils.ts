import { DataSource, EntityManager, In } from 'typeorm';
import { TypeOrmError } from '../../errors';
import { Keyword } from '../Keyword';
import {
  EventLogger,
  notifyContentRequested,
  uniqueifyArray,
} from '../../common';
import { User } from '../User';
import { PostKeyword } from '../PostKeyword';
import { ArticlePost } from './ArticlePost';
import { Post, PostOrigin } from './Post';
import { MAX_COMMENTARY_LENGTH, SharePost } from './SharePost';
import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import { Source, UNKNOWN_SOURCE } from '../Source';
import { generateShortId } from '../../ids';
import { FreeformPost } from './FreeformPost';
import { parse } from 'node-html-parser';
import { ContentImage, ContentImageUsedByType } from '../ContentImage';

export type PostStats = {
  numPosts: number;
  numPostViews: number;
  numPostUpvotes: number;
  numPostComments: number;
};

type StringPostStats = {
  [Property in keyof PostStats]: string;
};

export const getAuthorPostStats = async (
  con: DataSource,
  authorId: string,
): Promise<PostStats> => {
  const raw = await con
    .createQueryBuilder()
    .select('count(*)', 'numPosts')
    .addSelect('sum(post.views)', 'numPostViews')
    .addSelect('sum(post.upvotes)', 'numPostUpvotes')
    .addSelect('sum(post.comments)', 'numPostComments')
    .from(Post, 'post')
    .where('(post.authorId = :authorId or post.scoutId = :authorId)', {
      authorId,
    })
    .andWhere('post.visible = true')
    .andWhere('post.deleted = false')
    .getRawOne<StringPostStats>();
  return Object.keys(raw).reduce(
    (acc, key) => ({ ...acc, [key]: parseInt(raw[key]) || raw[key] }),
    {},
  ) as PostStats;
};

export const parseReadTime = (
  readTime: number | string | undefined,
): number | undefined => {
  if (!readTime) {
    return undefined;
  }
  if (typeof readTime == 'number') {
    return Math.floor(readTime);
  }
  return Math.floor(parseInt(readTime));
};

export const bannedAuthors = ['@NewGenDeveloper'];

export const mergeKeywords = async (
  entityManager: EntityManager,
  keywords?: string[],
): Promise<{ mergedKeywords: string[]; allowedKeywords: string[] }> => {
  if (keywords?.length) {
    const synonymKeywords = await entityManager.getRepository(Keyword).find({
      where: {
        status: 'synonym',
        value: In(keywords),
      },
    });
    const additionalKeywords = synonymKeywords.map(
      (synonym) => synonym.synonym,
    );
    const mergedKeywords = uniqueifyArray(
      [...keywords, ...additionalKeywords].filter(
        (keyword) => !keyword.match(/^\d+$/),
      ),
    );
    const allowedKeywords = await entityManager.getRepository(Keyword).find({
      where: {
        status: 'allow',
        value: In(mergedKeywords),
      },
      order: { occurrences: 'DESC' },
    });
    return {
      allowedKeywords: allowedKeywords.map((keyword) => keyword.value),
      mergedKeywords,
    };
  }
  return { allowedKeywords: [], mergedKeywords: [] };
};

export const findAuthor = async (
  entityManager: EntityManager,
  creatorTwitter?: string,
): Promise<string | null> => {
  if (creatorTwitter && typeof creatorTwitter === 'string') {
    const twitter = (
      creatorTwitter[0] === '@' ? creatorTwitter.substr(1) : creatorTwitter
    ).toLowerCase();
    const author = await entityManager
      .getRepository(User)
      .createQueryBuilder()
      .select('id')
      .where(
        `lower(twitter) = :twitter or (lower(username) = :twitter and username = 'addyosmani')`,
        {
          twitter,
        },
      )
      .getRawOne();
    if (author) {
      return author.id;
    }
  }
  return null;
};

export const removeKeywords = async (
  entityManager: EntityManager,
  mergedKeywords: string[],
  postId: string,
) => {
  if (mergedKeywords.length) {
    await entityManager.getRepository(PostKeyword).delete({ postId });
  }
  return;
};

export const addKeywords = async (
  entityManager: EntityManager,
  mergedKeywords: string[],
  postId: string,
): Promise<void> => {
  if (mergedKeywords?.length) {
    await entityManager
      .createQueryBuilder()
      .insert()
      .into(Keyword)
      .values(mergedKeywords.map((keyword) => ({ value: keyword })))
      .onConflict(
        `("value") DO UPDATE SET occurrences = keyword.occurrences + 1`,
      )
      .execute();
    await entityManager.getRepository(PostKeyword).insert(
      mergedKeywords.map((keyword) => ({
        keyword,
        postId,
      })),
    );
  }
  return;
};

const validateCommentary = async (commentary: string) => {
  if (commentary.length > MAX_COMMENTARY_LENGTH) {
    throw new ValidationError(
      JSON.stringify({
        commentary: `max size is ${MAX_COMMENTARY_LENGTH} chars`,
      }),
    );
  }
  return true;
};

export interface ExternalLinkPreview {
  id?: string;
  title: string;
  image: string;
}

export interface ExternalLink extends Partial<ExternalLinkPreview> {
  url: string;
}

export const createExternalLink = async (
  con: DataSource | EntityManager,
  logger: EventLogger,
  sourceId: string,
  userId: string,
  { url, title, image }: ExternalLink,
  commentary: string,
): Promise<void> => {
  await validateCommentary(commentary);
  const id = await generateShortId();
  const isVisible = !!title;

  return con.transaction(async (entityManager) => {
    await entityManager.getRepository(ArticlePost).insert({
      id,
      shortId: id,
      createdAt: new Date(),
      sourceId: UNKNOWN_SOURCE,
      url,
      canonicalUrl: url,
      title,
      image,
      sentAnalyticsReport: true,
      private: true,
      origin: PostOrigin.Squad,
      visible: isVisible,
    });
    await createSharePost(
      entityManager,
      sourceId,
      userId,
      id,
      commentary,
      isVisible,
    );
    await notifyContentRequested(logger, {
      id,
      url,
      origin: PostOrigin.Squad,
    });
    return;
  });
};

export const createSharePost = async (
  con: DataSource | EntityManager,
  sourceId: string,
  userId: string,
  postId: string,
  commentary: string,
  visible = true,
): Promise<SharePost> => {
  await validateCommentary(commentary);
  const id = await generateShortId();
  try {
    const { private: privacy } = await con
      .getRepository(Source)
      .findOneBy({ id: sourceId });
    return await con.getRepository(SharePost).save({
      id,
      shortId: id,
      createdAt: new Date(),
      sourceId,
      authorId: userId,
      sharedPostId: postId,
      title: commentary,
      sentAnalyticsReport: true,
      private: privacy,
      origin: PostOrigin.UserGenerated,
      visible,
      visibleAt: visible ? new Date() : null,
    });
  } catch (err) {
    if (err.code === TypeOrmError.FOREIGN_KEY) {
      if (err.detail.indexOf('sharedPostId') > -1) {
        throw new ForbiddenError(
          JSON.stringify({ postId: 'post does not exist' }),
        );
      }
    }
    throw err;
  }
};

export const updateUsedImagesInContent = async (
  con: DataSource | EntityManager,
  type: ContentImageUsedByType,
  { id, contentHtml }: Pick<FreeformPost, 'contentHtml' | 'id'>,
): Promise<void> => {
  const root = parse(contentHtml);
  const images = root.querySelectorAll('img');
  const urls = images.map((img) => img.getAttribute('src'));
  await con.getRepository(ContentImage).update(
    { url: In(urls) },
    {
      usedByType: type,
      usedById: id,
    },
  );
};
