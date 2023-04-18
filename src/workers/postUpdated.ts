import { messageToJson, Worker } from './worker';
import * as he from 'he';
import {
  addKeywords,
  ArticlePost,
  bannedAuthors,
  findAuthor,
  mergeKeywords,
  parseReadTime,
  PostOrigin,
  SharePost,
  Source,
  Toc,
  UNKNOWN_SOURCE,
} from '../entity';

interface Data {
  post_id: string;
  url: string;
  image?: string;
  title?: string;
  content_type?: string;
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
  };
}

const worker: Worker = {
  subscription: 'api.content-published',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    logger.info({ data }, 'content-updated received');
    try {
      const { post_id, updated_at } = data;
      if (!post_id) {
        return;
      }
      const updatedDate = new Date(updated_at);
      await con.transaction(async (entityManager) => {
        // For now, we only allow Squad posts to be updated through this flow
        const databasePost = await entityManager
          .getRepository(ArticlePost)
          .findOneBy({ id: post_id, origin: PostOrigin.Squad });

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
        const title = data?.title || databasePost.title;
        const becomesVisible = !!title.length;

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

        const { private: privacy } = await entityManager
          .getRepository(Source)
          .findOneBy({ id: data?.source_id });

        const fixedData: Partial<ArticlePost> = {
          origin: data?.origin as PostOrigin,
          authorId,
          creatorTwitter,
          url: data?.url,
          canonicalUrl: data?.extra?.canonical_url || data?.url,
          image: data?.image,
          sourceId: data?.source_id,
          title: title && he.decode(title),
          readTime: parseReadTime(data?.extra?.read_time),
          publishedAt: data?.published_at && new Date(data?.published_at),
          metadataChangedAt: updatedDate,
          visible: becomesVisible,
          visibleAt: becomesVisible
            ? databasePost.visibleAt ?? updatedDate
            : null,
          tagsStr: allowedKeywords?.join(',') || null,
          private: privacy,
          sentAnalyticsReport: privacy || !authorId,
          summary: data?.extra?.summary,
          description: data?.extra?.description,
          siteTwitter: data?.extra?.site_twitter,
          toc: data?.extra?.toc,
        };

        await entityManager
          .getRepository(ArticlePost)
          .update({ id: databasePost.id }, fixedData);

        if (becomesVisible) {
          // Update all reffering posts to become visible
          await entityManager
            .getRepository(SharePost)
            .update(
              { sharedPostId: databasePost.id },
              { visible: true, visibleAt: updatedDate, private: privacy },
            );
        }

        await addKeywords(entityManager, mergedKeywords, data.post_id);
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
