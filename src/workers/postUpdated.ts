import { messageToJson, Worker } from './worker';
import { ArticlePost, SharePost } from '../entity';

interface Data extends ArticlePost {
  updated_at: Date;
}

const worker: Worker = {
  subscription: 'api.post-updated',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const { id, updated_at } = data;
      const updatedDate = new Date(updated_at);
      await con.transaction(async (entityManager) => {
        const databasePost = await entityManager
          .getRepository(ArticlePost)
          .findOneBy({ id });

        if (
          !databasePost ||
          databasePost.metadataChangedAt.toISOString() >=
            updatedDate.toISOString()
        ) {
          return;
        }

        const becomesVisible = !databasePost?.visible && !!data?.title?.length;

        await entityManager.getRepository(ArticlePost).update(
          { id: databasePost.id },
          {
            summary: data?.summary,
            description: data?.description,
            readTime: data?.readTime,
            toc: data?.toc,
            keywords: data?.keywords,
            siteTwitter: data?.siteTwitter,
            creatorTwitter: data?.creatorTwitter,
            sourceId: data?.sourceId,
            image: data?.image,
            title: data?.title,
            metadataChangedAt: updatedDate,
            visible: becomesVisible,
            visibleAt: becomesVisible ? updatedDate : null,
          },
        );

        if (becomesVisible) {
          // Update all reffering posts to become visible
          await entityManager
            .getRepository(SharePost)
            .update(
              { sharedPostId: databasePost.id },
              { visible: true, visibleAt: updatedDate },
            );
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
