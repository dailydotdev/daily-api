import { Cron } from './cron';
import { Checkpoint } from '../entity/Checkpoint';

const cron: Cron = {
  name: 'update-tags-str',
  handler: async (con) => {
    const checkpointKey = 'last_tags_str_update';
    const before = new Date();
    let checkpoint = await con.getRepository(Checkpoint).findOne(checkpointKey);
    const after = checkpoint?.timestamp || new Date();

    await con.transaction(async (entityManager): Promise<void> => {
      await entityManager.query(
        `update post
          set "tagsStr" = res.tags
          from (
             select pk."postId", array_to_string((array_agg(pk.keyword order by k.occurrences desc, pk.keyword)), ',') as tags
             from post_keyword pk
             inner join keyword k on pk.keyword = k.value and k.status = 'allow'
             group by pk."postId"
          ) as res
          where post.id = res."postId" and exists(
              select * from post_keyword pk
              inner join keyword k on pk.keyword = k.value and k.status != 'pending'
              where pk."postId" = post.id and k."updatedAt" >= $1
              )`,
        [after],
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
