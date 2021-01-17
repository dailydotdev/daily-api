import { messageToJson, Worker } from './worker';
import { EntityManager } from 'typeorm';

interface Data {
  keyword: string;
}

const updateTagsStrByKeyword = (
  entityManager: EntityManager,
  keyword: string,
): Promise<void> =>
  entityManager.query(
    `update post
          set "tagsStr" = res.tags
          from (
             select pk."postId", array_to_string((array_agg(pk.keyword order by k.occurrences desc, pk.keyword)), ',') as tags
             from post_keyword pk
             inner join keyword k on pk.keyword = k.value and k.status = 'allow'
             group by pk."postId"
          ) as res
          where post.id = res."postId" and exists(select * from post_keyword pk where pk."postId" = post.id and pk.keyword = $1)`,
    [keyword],
  );

const worker: Worker = {
  subscription: 'keyword-updated-tags-str',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      await con.transaction(async (entityManager) => {
        await updateTagsStrByKeyword(entityManager, data.keyword);
      });
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.id,
          err,
        },
        'failed to update tagsStr',
      );
      throw err;
    }
  },
};

export default worker;
