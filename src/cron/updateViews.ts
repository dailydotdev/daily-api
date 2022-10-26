import { Cron } from './cron';
import { Checkpoint } from '../entity/Checkpoint';

const cron: Cron = {
  name: 'update-views',
  handler: async (con) => {
    const checkpointKey = 'last_views_update';
    const before = new Date();
    let checkpoint = await con.getRepository(Checkpoint).findOne(checkpointKey);
    const after = checkpoint?.timestamp || new Date(0);

    await con.transaction(async (entityManager): Promise<void> => {
      await entityManager.query(
        `update "public"."post" p
         set views = p.views + v.count,
             score = extract(EPOCH FROM p."createdAt") / 60 +
                     POW(LOG(5, (p.views + p.upvotes * 2.5 + p.comments * 4 +
                                 v.count + v."rankBoost") + 1), 2) * 60 FROM (
                select v.*, s."rankBoost"
                from (
                  select count(*) count, "view"."postId"
                  from "view"
                  inner join "post" on "post".id = "view"."postId"
                  where
                    ("view".timestamp >= $1 and "view".timestamp < $2) or
           ("post"."createdAt" >= $1 and "post"."createdAt" < $2)
           group by "view"."postId"
           ) v
           inner join "post" p on p.id = v."postId"
           inner join "source" s on s.id = p."sourceId"
           ) v
         WHERE p.id = v."postId"`,
        [after, before],
      );
      if (!checkpoint) {
        checkpoint = new Checkpoint();
        checkpoint.key = checkpointKey;
      }
      checkpoint.timestamp = before;
      await entityManager.getRepository(Checkpoint).save(checkpoint);
    });
  },
};

export default cron;
