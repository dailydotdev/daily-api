import { Cron } from './cron';
import { Checkpoint } from '../entity/Checkpoint';
import { notifyCommentFeatured } from '../common';

const FEATURED_LIMIT = 3;

type UpdateResult = [{ id: string }[]];

const cron: Cron = {
  name: 'update-featured-comments',
  handler: async (con, logger) => {
    const checkpointKey = 'last_featured_comments_update';
    const before = new Date();
    let checkpoint = await con
      .getRepository(Checkpoint)
      .findOneBy({ key: checkpointKey });
    const after = checkpoint?.timestamp || new Date(0);

    const newFeatured = await con.transaction(
      async (entityManager): Promise<string[]> => {
        const postsQuery = `SELECT c."postId"
                  FROM "comment_upvote" cu
                  INNER JOIN "comment" c ON c."id" = cu."commentId"
                  WHERE cu."createdAt" >= $1
                    AND cu."createdAt" < $2
                    AND c."parentId" IS NULL
                  GROUP BY "postId"`;
        const [oldFeatured]: UpdateResult = await entityManager.query(
          `UPDATE "comment" c
            SET featured = FALSE
            FROM (${postsQuery}) res
            WHERE c."postId" = res."postId"
                AND c.featured = TRUE
            RETURNING id`,
          [after, before],
        );
        const [newFeatured]: UpdateResult = await entityManager.query(
          `UPDATE "comment" c
             SET featured = TRUE
             FROM (
                SELECT c.id "commentId"
                FROM (${postsQuery}) p
                INNER JOIN (
                  SELECT DISTINCT ON (c."userId") c.id, c."postId", ROW_NUMBER() OVER (PARTITION BY c."postId" ORDER BY c.upvotes DESC) r
                  FROM "comment" c
                  WHERE c.upvotes >= 3
                ) c ON c."postId" = p."postId"
                WHERE c.r <= ${FEATURED_LIMIT}
             ) res
             WHERE c."id" = res."commentId"
             RETURNING id`,
          [after, before],
        );
        if (!checkpoint) {
          checkpoint = new Checkpoint();
          checkpoint.key = checkpointKey;
        }
        checkpoint.timestamp = before;
        await entityManager.getRepository(Checkpoint).save(checkpoint);
        return newFeatured
          .filter(({ id }) => oldFeatured.findIndex((old) => old.id === id) < 0)
          .map(({ id }) => id);
      },
    );
    if (newFeatured.length) {
      logger.info('new featured comments');
      await Promise.all(
        newFeatured.map((id) => notifyCommentFeatured(logger, id)),
      );
    }
  },
};

export default cron;
