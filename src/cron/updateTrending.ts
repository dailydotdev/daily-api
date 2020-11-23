import { Cron } from './cron';

const cron: Cron = {
  name: 'update-trending',
  handler: (con) =>
    con.transaction(async (entityManager) => {
      await entityManager.query(`
update "post" set "trending" = res."total", "lastTrending" = now()
from (
    select "postId", count(*) total, count(*) filter(where "timestamp" >= timezone('utc', now()) - interval '30 minutes') as "partial"
    from "view"
    where "timestamp" >= timezone('utc', now()) - interval '1 hour'
    group by "postId"
) as res
where "post".id = res."postId" and res."partial" != res."total" and res."total" >= 30 and (res."partial" * 1.0 / res."total") >= 0.6
`);
      await entityManager.query(`
update "post" set "trending" = null
where "lastTrending" <= now() - interval '15 minutes' and "trending" is not null
`);
    }),
};

export default cron;
