import { Cron } from './cron';
import { Checkpoint } from '../entity/Checkpoint';
import { getPostsIndex } from '../common';

const cron: Cron = {
  name: 'updateViews',
  handler: async (con) => {
    const checkpointKey = 'last_views_update';
    const before = new Date();
    let checkpoint = await con.getRepository(Checkpoint).findOne(checkpointKey);
    const after = checkpoint?.timestamp || new Date(0);

    await con.transaction(
      async (entityManager): Promise<void> => {
        await entityManager.query(
          `UPDATE "public"."post" p
             SET views = p.views + v.count,
                 score = EXTRACT(EPOCH FROM p."createdAt") / 60 +
                         POW(LOG(5, (p.views + v.count) + 1), 2) * 60
             FROM (SELECT COUNT(*) count, "postId"
                   FROM "public"."view"
                   WHERE timestamp >= $1
                     AND timestamp < $2
                   GROUP BY "postId") v
             WHERE p.id = v."postId"`,
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

    const updatedPosts = await con.query(
      `SELECT p.id "objectID", p.views
         FROM "public"."post" p
                INNER JOIN (SELECT "postId"
                            FROM "public"."view"
                            WHERE "timestamp" >= $1
                              AND "timestamp" < $2
                            GROUP BY "postId") AS v
                           ON p.id = v."postId"`,
      [after, before],
    );
    await getPostsIndex().partialUpdateObjects(updatedPosts);
  },
};

export default cron;
