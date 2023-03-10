import { messageToJson, Worker } from './worker';
import * as he from 'he';
import {
  addTagsAndKeywords,
  ArticlePost,
  bannedAuthors,
  findAuthor,
  mergeKeywords,
  parseReadTime,
  PostOrigin,
  SharePost,
  Source,
} from '../entity';

interface Data extends Omit<ArticlePost, 'keywords' | 'tags'> {
  updated_at: Date;
  keywords: string[];
  tags: string[];
}

const worker: Worker = {
  subscription: 'api.content-published',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const { id, updated_at } = data;
      const updatedDate = new Date(updated_at);
      await con.transaction(async (entityManager) => {
        // For now, we only allow Squad posts to be updated through this flow
        const databasePost = await entityManager
          .getRepository(ArticlePost)
          .findOneBy({ id, origin: PostOrigin.Squad });

        if (
          !databasePost ||
          databasePost.metadataChangedAt.toISOString() >=
            updatedDate.toISOString()
        ) {
          return;
        }

        if (bannedAuthors.indexOf(data?.creatorTwitter) > -1) {
          logger.info(
            { data, messageId: message.messageId },
            'post update failed because author is banned',
          );
          return;
        }

        const creatorTwitter =
          data.creatorTwitter === '' || data.creatorTwitter === '@'
            ? null
            : data.creatorTwitter;

        const authorId = await findAuthor(entityManager, creatorTwitter);
        const becomesVisible = !databasePost?.visible && !!data?.title?.length;
        const { tags, keywords, ...submittedData } = data;

        const { allowedKeywords, mergedKeywords } = await mergeKeywords(
          entityManager,
          keywords,
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
          .findOneBy({ id: data?.sourceId });

        const fixedData = {
          ...submittedData,
          authorId,
          creatorTwitter,
          canonicalUrl: data?.canonicalUrl || data?.url,
          title: data?.title && he.decode(data?.title),
          readTime: parseReadTime(data?.readTime),
          publishedAt: data?.publishedAt && new Date(data?.publishedAt),
          metadataChangedAt: updatedDate,
          visible: becomesVisible,
          visibleAt: becomesVisible ? updatedDate : null,
          tagsStr: allowedKeywords?.join(',') || null,
          private: privacy,
          sentAnalyticsReport: !data?.authorId,
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

        await addTagsAndKeywords(entityManager, tags, mergedKeywords, data.id);
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
