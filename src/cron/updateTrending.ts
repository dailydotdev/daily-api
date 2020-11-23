import { Cron } from './cron';

const cron: Cron = {
  name: 'update-trending',
  handler: (con) =>
    con.transaction(async (entityManager) => {
      await entityManager.query(`
update "post" set "trending" = res."views", "lastTrending" = now()
from (
    select "postId", count(distinct "userId") as "views"
    from "view"
    where "timestamp" >= now() - interval '1 hour'
    group by "postId"
) as res
where "post".id = res."postId" and res."views" >= 100
`);
      await entityManager.query(`
update "post" set "trending" = null
where "lastTrending" <= now() - interval '30 minutes' and "trending" is not null
`);
    }),
};

export default cron;
