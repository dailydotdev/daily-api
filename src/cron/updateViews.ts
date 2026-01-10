import { Cron } from './cron';
import { Checkpoint } from '../entity/Checkpoint';

const cron: Cron = {
  name: 'update-views',
  handler: async (con) => {
    const checkpointKey = 'last_views_update';
    const before = new Date();
    let checkpoint = await con
      .getRepository(Checkpoint)
      .findOneBy({ key: checkpointKey });
    const after = checkpoint?.timestamp || new Date(0);

    await con.transaction(async (entityManager): Promise<void> => {
      await entityManager.query(
        `update "post" p
         set views = p.views + v.count FROM (
                select count(*) count, "view"."postId"
                from "view"
                where "view".timestamp >= $1 and "view".timestamp
           < $2
           group by "view"."postId"
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
