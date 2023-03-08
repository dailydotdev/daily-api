import { DataSource, EntityManager, In } from 'typeorm';
import { SubmissionFailErrorKeys, TypeOrmError } from '../../errors';
import * as he from 'he';
import { Keyword } from '../Keyword';
import {
  EventLogger,
  notifyContentRequested,
  uniqueifyArray,
} from '../../common';
import { User } from '../User';
import { FastifyLoggerInstance } from 'fastify';
import { PostTag } from '../PostTag';
import { PostKeyword } from '../PostKeyword';
import { validateAndApproveSubmission } from '../Submission';
import { ArticlePost, Toc } from './ArticlePost';
import { Post, PostOrigin } from './Post';
import { MAX_COMMENTARY_LENGTH, SharePost } from './SharePost';
import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import { Source } from '../Source';
import { generateShortId } from '../../ids';

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
    .andWhere({ deleted: false })
    .getRawOne<StringPostStats>();
  return Object.keys(raw).reduce(
    (acc, key) => ({ ...acc, [key]: parseInt(raw[key]) || raw[key] }),
    {},
  ) as PostStats;
};

export interface RejectPostData {
  submissionId: string;
  reason?: string;
}

export interface AddPostData {
  id: string;
  title: string;
  url: string;
  publicationId: string;
  publishedAt?: string | Date;
  createdAt?: Date;
  image?: string;
  ratio?: number;
  placeholder?: string;
  tags?: string[];
  siteTwitter?: string;
  creatorTwitter?: string;
  authorId?: string;
  readTime?: number;
  canonicalUrl?: string;
  keywords?: string[];
  description?: string;
  toc?: Toc;
  summary?: string;
  submissionId?: string;
  scoutId?: string;
  origin?: PostOrigin;
}

const parseReadTime = (
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

type Reason = SubmissionFailErrorKeys;
export type AddNewPostResult =
  | { status: 'ok'; postId: string }
  | { status: 'failed'; reason: Reason; error?: Error };

type RejectReason = 'missing submission id';
export type RejectPostResult =
  | { status: 'ok'; submissionId: string }
  | { status: 'failed'; reason: RejectReason; error?: Error };

const checkRequiredFields = (data: AddPostData): boolean => {
  return !!(data && data.title && data.url && data.publicationId);
};

const bannedAuthors = ['@NewGenDeveloper'];

const shouldAddNewPost = async (
  entityManager: EntityManager,
  data: AddPostData,
): Promise<Reason | null> => {
  const p = await entityManager
    .getRepository(Post)
    .createQueryBuilder()
    .select('id')
    .where(
      'url = :url or url = :canonicalUrl or "canonicalUrl" = :url or "canonicalUrl" = :canonicalUrl',
      { url: data.url, canonicalUrl: data.canonicalUrl },
    )
    .getRawOne();
  if (p) {
    return 'POST_EXISTS';
  }
  if (bannedAuthors.indexOf(data.creatorTwitter) > -1) {
    return 'AUTHOR_BANNED';
  }

  if (!data.title) {
    return 'MISSING_FIELDS';
  }
};

const fixAddPostData = async (data: AddPostData): Promise<AddPostData> => ({
  ...data,
  id: await generateShortId(),
  canonicalUrl: data.canonicalUrl || data.url,
  title: data.title && he.decode(data.title),
  createdAt: new Date(),
  readTime: parseReadTime(data.readTime),
  publishedAt: data.publishedAt && new Date(data.publishedAt),
});

const mergeKeywords = async (
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

const findAuthor = async (
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

const addPostAndKeywordsToDb = async (
  entityManager: EntityManager,
  data: AddPostData,
  logger: FastifyLoggerInstance,
): Promise<string> => {
  const { allowedKeywords, mergedKeywords } = await mergeKeywords(
    entityManager,
    data.keywords,
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
  const { private: privacy } = await entityManager
    .getRepository(Source)
    .findOneBy({ id: data.publicationId });
  const post = await entityManager.getRepository(ArticlePost).create({
    id: data.id,
    shortId: data.id,
    publishedAt: data.publishedAt,
    createdAt: data.createdAt,
    sourceId: data.publicationId,
    url: data.url,
    title: data.title,
    image: data.image,
    ratio: data.ratio,
    placeholder: data.placeholder,
    score: Math.floor(data.createdAt.getTime() / (1000 * 60)),
    siteTwitter: data.siteTwitter,
    creatorTwitter: data.creatorTwitter,
    readTime: data.readTime,
    tagsStr: allowedKeywords?.join(',') || null,
    canonicalUrl: data.canonicalUrl,
    authorId: data.authorId,
    sentAnalyticsReport: !(data.authorId || data.scoutId),
    description: data.description,
    toc: data.toc,
    summary: data.summary,
    scoutId: data.scoutId,
    private: privacy,
    origin: data.scoutId
      ? PostOrigin.CommunityPicks
      : data.origin ?? PostOrigin.Crawler,
    visible: true,
    visibleAt: new Date(),
  });
  await entityManager.save(post);
  if (data.tags?.length) {
    await entityManager.getRepository(PostTag).insert(
      data.tags.map((t) => ({
        tag: t,
        postId: data.id,
      })),
    );
  }
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
        postId: data.id,
      })),
    );
  }
  return data.id;
};

export const addNewPost = async (
  con: DataSource,
  data: AddPostData,
  logger: FastifyLoggerInstance,
): Promise<AddNewPostResult> => {
  if (!checkRequiredFields(data)) {
    return { status: 'failed', reason: 'MISSING_FIELDS' };
  }

  const creatorTwitter =
    data.creatorTwitter === '' || data.creatorTwitter === '@'
      ? null
      : data.creatorTwitter;

  return con.transaction(async (entityManager) => {
    const authorId = await findAuthor(entityManager, creatorTwitter);
    const fixedData = await fixAddPostData({
      ...data,
      creatorTwitter,
      authorId,
    });

    const reason = await shouldAddNewPost(entityManager, fixedData);
    if (reason) {
      return { status: 'failed', reason };
    }

    const { scoutId, rejected } = (await validateAndApproveSubmission(
      entityManager,
      fixedData,
    )) || { scoutId: null, rejected: false };

    if (rejected) {
      return { status: 'failed', reason: 'SCOUT_IS_AUTHOR' };
    }

    const combinedData = {
      ...fixedData,
      scoutId,
    };

    try {
      const postId = await addPostAndKeywordsToDb(
        entityManager,
        combinedData,
        logger,
      );

      return { status: 'ok', postId };
    } catch (error) {
      // Unique
      if (error?.code === TypeOrmError.DUPLICATE_ENTRY) {
        return { status: 'failed', reason: 'POST_EXISTS', error };
      }
      // Null violation
      if (error?.code === TypeOrmError.NULL_VIOLATION) {
        return { status: 'failed', reason: 'MISSING_FIELDS', error };
      }
      throw error;
    }
  });
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

export const createPrivatePost = async (
  con: DataSource,
  logger: EventLogger,
  sourceId: string,
  userId: string,
  url: string,
  commentary: string,
): Promise<void> => {
  await validateCommentary(commentary);
  const id = await generateShortId();

  return con.transaction(async (entityManager) => {
    await entityManager.getRepository(ArticlePost).insert({
      id,
      shortId: id,
      createdAt: new Date(),
      sourceId,
      url,
      canonicalUrl: url,
      sentAnalyticsReport: true,
      private: true,
      origin: PostOrigin.Squad,
      visible: false,
    });
    await createSharePost(
      entityManager,
      sourceId,
      userId,
      id,
      commentary,
      false,
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
