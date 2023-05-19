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

const worker: Worker = {
  subscription: 'api.content-published',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    logger.info({ data }, 'content-updated received');
    try {
      // See if we received any rejections
      const { reject_reason, post_id, updated_at, submission_id } = data;
      await con.transaction(async (entityManager) => {
        if (reject_reason) {
          // Check if we have a submission id, we need to notify
          if (!submission_id) {
            logger.info({ data }, 'received rejection without submission id');
          }

          const submissionRepo = con.getRepository(Submission);
          const submission = await submissionRepo.findOneBy({
            id: submission_id,
          });
          if (submission.status === SubmissionStatus.Started) {
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
        }

        if (bannedAuthors.indexOf(data?.extra?.creator_twitter) > -1) {
          logger.info(
            { data, messageId: message.messageId },
            'post update failed because author is banned',
          );
          return;
        }

        const creatorTwitter =
          data?.extra?.creator_twitter === '' ||
          data?.extra?.creator_twitter === '@'
            ? null
            : data?.extra?.creator_twitter;

        const authorId = await findAuthor(entityManager, creatorTwitter);

        const { private: privacy } = await entityManager
          .getRepository(Source)
          .findOneBy({ id: data?.source_id });

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
        const fixedData: Partial<ArticlePost> = {
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
          metadataChangedAt: new Date(),
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
        };

        // See if post id is not available
        if (!post_id) {
          // Handle creation of new post
          const existingPost = await entityManager
            .getRepository(Post)
            .createQueryBuilder()
            .select('id')
            .where(
              'url = :url or url = :canonicalUrl or "canonicalUrl" = :url or "canonicalUrl" = :canonicalUrl',
              { url: fixedData.url, canonicalUrl: fixedData.canonicalUrl },
            )
            .getRawOne();
          if (existingPost) {
            logger.info(
              { data },
              'failed creating post because it exists already',
            );
            return;
          }

          if (data?.submission_id) {
            const submission = await entityManager
              .getRepository(Submission)
              .findOneBy({ id: data.submission_id });

            if (submission) {
              if (fixedData.authorId === submission.userId) {
                await entityManager.getRepository(Submission).update(
                  { id: data.submission_id },
                  {
                    status: SubmissionStatus.Rejected,
                    reason: SubmissionFailErrorKeys.ScoutIsAuthor,
                  },
                );
                return;
              }

              await entityManager.getRepository(Submission).update(
                { id: data.submission_id },
                {
                  status: SubmissionStatus.Accepted,
                },
              );
              fixedData.scoutId = submission.userId;
            }
          }

          const postId = await generateShortId();
          const postCreatedAt = new Date();
          fixedData.id = postId;
          fixedData.shortId = postId;
          fixedData.createdAt = postCreatedAt;
          fixedData.score = Math.floor(postCreatedAt.getTime() / (1000 * 60));
          fixedData.origin = fixedData?.scoutId
            ? PostOrigin.CommunityPicks
            : fixedData.origin ?? PostOrigin.Crawler;

          // TODO: Not sure if these are still needed?
          fixedData.ratio = null;
          fixedData.placeholder = null;

          const post = await entityManager
            .getRepository(ArticlePost)
            .create(fixedData);
          await entityManager.save(post);
        } else {
          // Handle update of existing post
          const updatedDate = new Date(updated_at);
          const databasePost = await entityManager
            .getRepository(ArticlePost)
            .findOneBy({ id: post_id });

          if (data?.origin === PostOrigin.Squad) {
            data.source_id = UNKNOWN_SOURCE;
          }

          if (
            !databasePost ||
            databasePost.metadataChangedAt.toISOString() >=
              updatedDate.toISOString()
          ) {
            return;
          }

          const title = data?.title || databasePost.title;
          const updateBecameVisible = !!title?.length;

          fixedData.id = databasePost.id;
          fixedData.metadataChangedAt = updatedDate;
          fixedData.title = title;
          fixedData.visible = updateBecameVisible;
          fixedData.visibleAt = updateBecameVisible
            ? databasePost.visibleAt ?? updatedDate
            : null;

          await entityManager
            .getRepository(ArticlePost)
            .update({ id: databasePost.id }, fixedData);
        }

        // After add or update:
        if (becomesVisible) {
          // Update all reffering posts to become visible
          await entityManager.getRepository(SharePost).update(
            { sharedPostId: fixedData.id },
            {
              visible: true,
              visibleAt: fixedData.visibleAt,
              private: privacy,
            },
          );
        }

        await addKeywords(entityManager, mergedKeywords, fixedData.id);
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
