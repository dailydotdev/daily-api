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
  removeKeywords,
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
import { updateFlagsStatement } from '../common';

interface Data {
  id: string;
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
  order?: number;
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
  submissionId?: string;
  mergedKeywords: string[];
};
const createPost = async ({
  logger,
  entityManager,
  data,
  submissionId,
  mergedKeywords,
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
    return null;
  }

  if (submissionId) {
    const submission = await entityManager
      .getRepository(Submission)
      .findOneBy({ id: submissionId });

    if (submission) {
      if (data.authorId === submission.userId) {
        await entityManager.getRepository(Submission).update(
          { id: submissionId },
          {
            status: SubmissionStatus.Rejected,
            reason: SubmissionFailErrorKeys.ScoutIsAuthor,
          },
        );
        return null;
      }

      await entityManager.getRepository(Submission).update(
        { id: submissionId },
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

  const post = await entityManager.getRepository(ArticlePost).create(data);
  await entityManager.save(post);

  await addKeywords(entityManager, mergedKeywords, data.id);

  return;
};

type UpdatePostProps = {
  entityManager: EntityManager;
  data: Partial<ArticlePost>;
  id: string;
  mergedKeywords: string[];
};
const updatePost = async ({
  entityManager,
  data,
  id,
  mergedKeywords,
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
    return null;
  }

  const title = data?.title || databasePost.title;
  const updateBecameVisible = !databasePost.visible && !!title?.length;

  data.id = databasePost.id;
  data.metadataChangedAt = updatedDate;
  data.title = title;
  data.visible = updateBecameVisible;
  data.visibleAt = updateBecameVisible
    ? databasePost.visibleAt ?? updatedDate
    : null;

  await entityManager.getRepository(ArticlePost).update(
    { id: databasePost.id },
    {
      ...data,
      flags: updateFlagsStatement<Post>({
        ...data.flags,
        visible: data.visible,
      }),
    },
  );

  if (updateBecameVisible) {
    await entityManager.getRepository(SharePost).update(
      { sharedPostId: data.id },
      {
        visible: true,
        visibleAt: data.visibleAt,
        private: data.private,
        flags: updateFlagsStatement<Post>({
          ...data.flags,
          private: data.private,
          visible: true,
        }),
      },
    );
  }

  if (databasePost.tagsStr !== data.tagsStr) {
    if (databasePost.tagsStr?.length) {
      await removeKeywords(
        entityManager,
        databasePost.tagsStr.split(','),
        data.id,
      );
    }
    await addKeywords(entityManager, mergedKeywords, data.id);
  }

  return;
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
      showOnFeed: !data?.order,
      flags: {
        private: privacy,
        visible: becomesVisible,
        showOnFeed: !data?.order,
        sentAnalyticsReport: privacy || !authorId,
      },
      yggdrasilId: data?.id,
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
          return handleRejection({ logger, data, entityManager });
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
        if (!post_id) {
          // Handle creation of new post
          await createPost({
            logger,
            entityManager,
            data: fixedData,
            submissionId: data?.submission_id,
            mergedKeywords,
          });
        } else {
          // Handle update of existing post
          await updatePost({
            entityManager,
            data: fixedData,
            id: post_id,
            mergedKeywords,
          });
        }
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
