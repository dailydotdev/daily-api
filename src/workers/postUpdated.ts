import { messageToJson, Worker } from './worker';
import * as he from 'he';
import {
  addKeywords,
  ArticlePost,
  bannedAuthors,
  findAuthor,
  mergeKeywords,
  parseReadTime,
  Post,
  PostOrigin,
  SharePost,
  Source,
  Submission,
  SubmissionStatus,
  Toc,
  UNKNOWN_SOURCE,
} from '../entity';
import { SubmissionFailErrorKeys, SubmissionFailErrorMessage } from '../errors';
import { generateShortId } from '../ids';
import { FastifyBaseLogger } from 'fastify';
import { EntityManager } from 'typeorm';

interface Data {
  post_id: string;
  url: string;
  image?: string;
  title?: string;
  content_type?: string;
  reject_reason?: string;
  submission_id?: string;
  source_id?: string;
  origin?: string;
  published_at?: Date;
  updated_at?: Date;
  paid?: boolean;
  extra?: {
    keywords?: string[];
    summary?: string;
    description?: string;
    read_time?: number;
    canonical_url?: string;
    site_twitter?: string;
    creator_twitter?: string;
    toc?: Toc;
    content_curation?: string[];
  };
}

type HandleRejectionProps = {
  logger: FastifyBaseLogger;
  entityManager: EntityManager;
  data: Data;
};
const handleRejection = async ({
  logger,
  entityManager,
  data,
}: HandleRejectionProps) => {
  const { reject_reason, submission_id } = data;
  if (!submission_id) {
    // Check if we have a submission id, we need to notify
    logger.info({ data }, 'received rejection without submission id');
    return;
  }

  const submissionRepo = entityManager.getRepository(Submission);
  const submission = await submissionRepo.findOneBy({
    id: submission_id,
  });
  if (submission?.status === SubmissionStatus.Started) {
    await submissionRepo.save({
      ...submission,
      status: SubmissionStatus.Rejected,
      reason:
        reject_reason in SubmissionFailErrorMessage
          ? <SubmissionFailErrorKeys>reject_reason
          : SubmissionFailErrorKeys.GenericError,
    });
  }

  return;
};

type CreatePostProps = {
  logger: FastifyBaseLogger;
  entityManager: EntityManager;
  data: Partial<ArticlePost>;
  submission_id?: string;
};
const createPost = async ({
  logger,
  entityManager,
  data,
  submission_id,
}: CreatePostProps) => {
  const existingPost = await entityManager
    .getRepository(Post)
    .createQueryBuilder()
    .select('id')
    .where(
      'url = :url or url = :canonicalUrl or "canonicalUrl" = :url or "canonicalUrl" = :canonicalUrl',
      { url: data.url, canonicalUrl: data.canonicalUrl },
    )
    .getRawOne();
  if (existingPost) {
    logger.info({ data }, 'failed creating post because it exists already');
    throw 'failed';
  }

  if (submission_id) {
    const submission = await entityManager
      .getRepository(Submission)
      .findOneBy({ id: submission_id });

    if (submission) {
      if (data.authorId === submission.userId) {
        await entityManager.getRepository(Submission).update(
          { id: submission_id },
          {
            status: SubmissionStatus.Rejected,
            reason: SubmissionFailErrorKeys.ScoutIsAuthor,
          },
        );
        throw 'rejected';
      }

      await entityManager.getRepository(Submission).update(
        { id: submission_id },
        {
          status: SubmissionStatus.Accepted,
        },
      );
      data.scoutId = submission.userId;
    }
  }

  const postId = await generateShortId();
  const postCreatedAt = new Date();
  data.id = postId;
  data.shortId = postId;
  data.createdAt = postCreatedAt;
  data.score = Math.floor(postCreatedAt.getTime() / (1000 * 60));
  data.origin = data?.scoutId
    ? PostOrigin.CommunityPicks
    : data.origin ?? PostOrigin.Crawler;

  // TODO: Not sure if these are still needed?
  data.ratio = null;
  data.placeholder = null;

  const post = await entityManager.getRepository(ArticlePost).create(data);
  await entityManager.save(post);
  return data;
};

type UpdatePostProps = {
  logger: FastifyBaseLogger;
  entityManager: EntityManager;
  data: Partial<ArticlePost>;
  id: string;
};
const updatePost = async ({
  logger,
  entityManager,
  data,
  id,
}: UpdatePostProps) => {
  const updatedDate = new Date(data.metadataChangedAt);
  const databasePost = await entityManager
    .getRepository(ArticlePost)
    .findOneBy({ id });

  if (data?.origin === PostOrigin.Squad) {
    data.sourceId = UNKNOWN_SOURCE;
  }

  if (
    !databasePost ||
    databasePost.metadataChangedAt.toISOString() >= updatedDate.toISOString()
  ) {
    return;
  }

  const title = data?.title || databasePost.title;
  const updateBecameVisible = !!title?.length;

  data.id = databasePost.id;
  data.metadataChangedAt = updatedDate;
  data.title = title;
  data.visible = updateBecameVisible;
  data.visibleAt = updateBecameVisible
    ? databasePost.visibleAt ?? updatedDate
    : null;

  await entityManager
    .getRepository(ArticlePost)
    .update({ id: databasePost.id }, data);
  return data;
};

type FixDataProps = {
  logger: FastifyBaseLogger;
  entityManager: EntityManager;
  data: Data;
};
type FixData = {
  mergedKeywords: string[];
  fixedData: Partial<ArticlePost>;
};
const fixData = async ({
  logger,
  entityManager,
  data,
}: FixDataProps): Promise<FixData> => {
  const creatorTwitter =
    data?.extra?.creator_twitter === '' || data?.extra?.creator_twitter === '@'
      ? null
      : data?.extra?.creator_twitter;

  const authorId = await findAuthor(entityManager, creatorTwitter);

  const { private: privacy } = await entityManager
    .getRepository(Source)
    .findOne({
      select: {
        private: true,
      },
      where: {
        id: data?.source_id,
      },
    });

  const { allowedKeywords, mergedKeywords } = await mergeKeywords(
    entityManager,
    data?.extra?.keywords,
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

  const becomesVisible = !!data?.title?.length;

  // Try and fix generic data here
  return {
    mergedKeywords,
    fixedData: {
      origin: data?.origin as PostOrigin,
      authorId,
      creatorTwitter,
      url: data?.url,
      canonicalUrl: data?.extra?.canonical_url || data?.url,
      image: data?.image,
      sourceId: data?.source_id,
      title: data?.title && he.decode(data?.title),
      readTime: parseReadTime(data?.extra?.read_time),
      publishedAt: data?.published_at && new Date(data?.published_at),
      metadataChangedAt: data?.updated_at || new Date(),
      visible: becomesVisible,
      visibleAt: becomesVisible ? new Date() : null,
      tagsStr: allowedKeywords?.join(',') || null,
      private: privacy,
      sentAnalyticsReport: privacy || !authorId,
      summary: data?.extra?.summary,
      description: data?.extra?.description,
      siteTwitter: data?.extra?.site_twitter,
      toc: data?.extra?.toc,
      contentCuration: data?.extra?.content_curation,
    },
  };
};

const worker: Worker = {
  subscription: 'api.content-published',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    logger.info({ data }, 'content-updated received');
    try {
      // See if we received any rejections
      const { reject_reason, post_id } = data;
      await con.transaction(async (entityManager) => {
        if (reject_reason) {
          return await handleRejection({ logger, data, entityManager });
        }

        if (bannedAuthors.indexOf(data?.extra?.creator_twitter) > -1) {
          logger.info(
            { data, messageId: message.messageId },
            'post update failed because author is banned',
          );
          return;
        }

        const { mergedKeywords, fixedData } = await fixData({
          logger,
          entityManager,
          data,
        });

        // See if post id is not available
        let combinedPost: Partial<ArticlePost>;
        if (!post_id) {
          // Handle creation of new post
          try {
            combinedPost = await createPost({
              logger,
              entityManager,
              data: fixedData,
              submission_id: data?.submission_id,
            });
          } catch (e) {
            return;
          }
        } else {
          // Handle update of existing post
          combinedPost = await updatePost({
            logger,
            entityManager,
            data: fixedData,
            id: post_id,
          });
        }

        // After add or update:
        if (combinedPost.visible) {
          // Update all referring posts to become visible
          await entityManager.getRepository(SharePost).update(
            { sharedPostId: combinedPost.id },
            {
              visible: true,
              visibleAt: combinedPost.visibleAt,
              private: combinedPost.private,
            },
          );
        }

        await addKeywords(entityManager, mergedKeywords, combinedPost.id);
      });
    } catch (err) {
      logger.error(
        { data, messageId: message.messageId, err },
        'failed to update post',
      );
    }
  },
};

export default worker;
