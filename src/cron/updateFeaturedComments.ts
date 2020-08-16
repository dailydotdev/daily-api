import { Cron } from './cron';
import { Checkpoint } from '../entity/Checkpoint';

const cron: Cron = {
  name: 'updateFeaturedComments',
  handler: async (con) => {
    const checkpointKey = 'last_featured_comments_update';
    const before = new Date();
    let checkpoint = await con.getRepository(Checkpoint).findOne(checkpointKey);
    const after = checkpoint?.timestamp || new Date(0);

    await con.transaction(
      async (entityManager): Promise<void> => {
        const postsQuery = `SELECT c."postId"
                  FROM "comment_upvote" cu
                  INNER JOIN "comment" c ON c."id" = cu."commentId"
                  WHERE cu."createdAt" >= $1
                    AND cu."createdAt" < $2
                    AND c."parentId" IS NULL
                  GROUP BY "postId"`;
        await entityManager.query(
          `UPDATE "comment" c
            SET featured = FALSE
            FROM (${postsQuery}) res
            WHERE c."postId" = res."postId"
                AND c.featured = TRUE`,
          [after, before],
        );
        await entityManager.query(
          `UPDATE "comment" c
             SET featured = TRUE
             FROM (
                SELECT (
                    SELECT c.id
                    FROM "comment" c
                    WHERE c."postId" = p."postId"
                        AND c.upvotes >= 3
                    ORDER BY c.upvotes DESC
                    LIMIT 1
                ) "commentId"
                FROM (${postsQuery}) p
             ) res
             WHERE c."id" = res."commentId"`,
          [after, before],
        );
        if (!checkpoint) {
          checkpoint = new Checkpoint();
          checkpoint.key = checkpointKey;
        }
        checkpoint.timestamp = before;
        await entityManager.getRepository(Checkpoint).save(checkpoint);
      },
    );
  },
};

export default cron;
