import { Cron } from './cron';

const cron: Cron = {
  name: 'updateTags',
  handler: (con) =>
    con.transaction(async (entityManager) => {
      await entityManager.query(`TRUNCATE TABLE "tag_count";`);
      await entityManager.query(`INSERT INTO "tag_count"
                                 SELECT t.tag tag, COUNT(*) count
                                 FROM "post_tag" t
                                        JOIN post p on t."postId" = p.id
                                 WHERE date_part('day', now() - p."createdAt") < 30
                                 GROUP BY t.tag`);
    }),
};

export default cron;
