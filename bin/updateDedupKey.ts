import '../src/config';
import createOrGetConnection from '../src/db';
import { FreeformPost, Post, PostType } from '../src/entity';
import { applyDeduplicationHook } from '../src/entity/posts/hooks';
import { logger } from '../src/logger';
import { updateFlagsStatement } from '../src/common';

const main = async () => {
  const con = await createOrGetConnection();

  try {
    logger.info('Starting dedup key update for freeform posts from last month');

    // Find freeform posts from last month with no dedup key
    const posts = await con
      .getRepository(Post)
      .createQueryBuilder('post')
      .select(['id', 'type', 'content', 'title'])
      .where('post.type = :type', { type: PostType.Freeform })
      .andWhere("post.createdAt >= current_timestamp - interval '30 day'")
      .andWhere("post.flags::jsonb ->> 'dedupKey' IS NULL")
      .limit(1000)
      .getRawMany();

    const totalCount = posts.length;
    logger.info({ totalCount }, 'Found posts without dedup key');

    if (totalCount === 0) {
      logger.info('No posts found that need dedup key updates');
      return;
    }

    // Process posts in batches
    let processedCount = 0;
    let updatedCount = 0;

    for (const post of posts) {
      try {
        // Apply deduplication hook to generate dedup key
        const updatedPost = await applyDeduplicationHook(post, con);

        // Check if dedup key was generated
        if (
          updatedPost.flags?.dedupKey &&
          updatedPost.flags.dedupKey !== post.flags?.dedupKey
        ) {
          // Update the post with the new dedup key
          await con.getRepository(FreeformPost).update(post.id, {
            flags: updateFlagsStatement(updatedPost.flags),
            metadataChangedAt: new Date(),
          });

          updatedCount++;
        }

        processedCount++;

        // Log progress every 50 posts
        if (processedCount % 50 === 0) {
          logger.info(
            {
              processed: processedCount,
              updated: updatedCount,
              total: totalCount,
            },
            'Progress update',
          );
        }
      } catch (error) {
        logger.error({ postId: post.id, error }, 'Failed to process post');
      }
    }

    logger.info(
      {
        totalProcessed: processedCount,
        totalUpdated: updatedCount,
        skipped: processedCount - updatedCount,
      },
      'Dedup key update completed',
    );
  } catch (error) {
    logger.error({ error }, 'Failed to update dedup keys');
    throw error;
  } finally {
    await con.destroy();
  }
};

main()
  .then(() => {
    logger.info('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error({ error: error.message }, 'Script failed');
    process.exit(1);
  });
