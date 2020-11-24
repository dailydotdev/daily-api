import { Cron } from './cron';

const cron: Cron = {
  name: 'update-trending',
  handler: (con) =>
    con.transaction(async (entityManager) => {
      await entityManager.query(`
update "post" set "trending" = null
where "trending" is not null
`);
      await entityManager.query(`
update "post" set "trending" = res."total", "lastTrending" = now()
from (
    select *
    from (
        select "postId", count(*) total, count(*) filter(where "timestamp" >= timezone('utc', now()) - interval '30 minutes') as "partial"
        from "view"
        inner join "post" on "view"."postId" = "post"."id"
        where "view"."timestamp" >= timezone('utc', now()) - interval '1 hour'
            and post."createdAt" <= timezone('utc', now()) - interval '30 minutes'
        group by "postId"
    ) res
    where res."partial" != res."total" and res."total" >= 30 and (res."partial" * 1.0 / res."total") >= 0.55
    order by (res."partial" * 1.0 / res."total") desc
    limit 3
) as res
where "post".id = res."postId"
`);
    }),
};

export default cron;
