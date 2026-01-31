import { Cron } from './cron';

const cron: Cron = {
  name: 'update-discussion-score',
  handler: async (con) => {
    await con.transaction(async (entityManager): Promise<void> => {
      await entityManager.query(
        `update post p
           set "discussionScore" = v.score
           FROM (
                  select
                      (round(rep / 10) + commenters * 3 + upvotes * 2 + comments) /
                      ceil(extract(EPOCH FROM now() - last_comment) / (60 * 60 * 24 * 7)) as score,
                      res.id
                  from (
                         select id,
                                "createdAt",
                                comments,
                                (select sum(reputation)
                                 from "user"
                                 where id in
                                       (select distinct("userId") from "comment" where "postId" = post.id)) as rep,
                                (select count(distinct "userId")
                                 from "comment"
                                 where "postId" = post.id)                                                  as commenters,
                                (select max(upvotes) from "comment" where "postId" = post.id)               as upvotes,
                                (select max("createdAt") from "comment" where "postId" = post.id)           as last_comment
                         from post
                       ) as res
                  where "last_comment" >= now() - interval '3 month'
                    and comments > 0
                ) v
           WHERE p.id = v.id`,
      );
      await entityManager.query(
        `update post p
           set "discussionScore" = null
           FROM (
                  select res.id
                  from (
                         select id,
                                "discussionScore",
                                  (select max("createdAt") from "comment" where "postId" = post.id) as last_comment
                         from post
                       ) as res
                  where "last_comment" < now() - interval '3 month'
                    and "discussionScore" > 0
                ) v
           WHERE p.id = v.id`,
      );
    });
  },
};

export default cron;
