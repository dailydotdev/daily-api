import { Cron } from './cron';
import { Checkpoint } from '../entity/Checkpoint';
import { Keyword, KeywordStatus } from '../entity';
import { MoreThanOrEqual, Not } from 'typeorm';

const cron: Cron = {
  name: 'update-tags-str',
  handler: async (con) => {
    const checkpointKey = 'last_tags_str_update';
    const before = new Date();
    let checkpoint = await con
      .getRepository(Checkpoint)
      .findOneBy({ key: checkpointKey });
    const after = checkpoint?.timestamp || new Date();

    await con.transaction(async (entityManager): Promise<void> => {
      const keywords = await entityManager.getRepository(Keyword).find({
        where: {
          status: Not(KeywordStatus.Pending),
          updatedAt: MoreThanOrEqual(after),
        },
      });
      if (keywords.length) {
        await entityManager.query(
          `update post
           set "tagsStr" = res.tags
           from (
                  select pk."postId",
                         array_to_string((array_agg(pk.keyword
                                                    order by pk.keyword asc, pk.keyword)),
                                         ',') as tags
                  from post_keyword pk
                  where pk.status = 'allow'
                  group by pk."postId"
                ) as res
           where post.id = res."postId"
             and exists(
             select keyword
             from post_keyword pk
             where pk."postId" = post.id
               and pk.keyword in (${keywords
                 .map(({ value }) => `'${value}'`)
                 .join(',')})
             )`,
        );
      }
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
