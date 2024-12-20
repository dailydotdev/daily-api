import {
  getUserActiveStateQuery,
  queryFromBq,
  sortUsersActiveState,
} from '../src/common/googleCloud';
import { subDays } from 'date-fns';
import {
  SUCCESSFUL_CIO_SYNC_DATE,
  syncSubscriptionsWithActiveState,
} from '../src/common';
import { setRedisObject } from '../src/redis';
import createOrGetConnection from '../src/db';

const userActiveStateQuery = `
  with d as (
    select u.primary_user_id,
    min(last_app_timestamp) as last_app_timestamp,
    min(registration_timestamp) as registration_timestamp,
    min(
      case
        when period_end is null then '4'
        when period_end between date(@run_date - interval 6*7 day) and @run_date then '1'
        when period_end between date(@run_date - interval 12*7 day) and date(@run_date - interval 6*7 + 1 day) then '2'
        when date(u.last_app_timestamp) <  date(@run_date - interval 12*7 day) then '3'
        when date(u.registration_timestamp) <  date(@run_date - interval 12*7 day) then '3'
        else '4' end
    ) as current_state,
    from analytics.user as u
    left join analytics.user_state_sparse as uss on uss.primary_user_id = u.primary_user_id
      and uss.period_end between '2018-01-01' and @run_date
      and uss.period = 'daily'
      and uss.app_active_state = 'active'
      and uss.registration_state = 'registered'
    where u.registration_timestamp is not null
    and date(u.registration_timestamp) < @run_date
    group by 1
  )
  select COUNT(*)
  from d
  where current_state != '1'
`;

const func = async () => {
  const runDate = subDays(new Date(), 1);
  const usersFromBqQuery = await getUserActiveStateQuery(
    runDate,
    userActiveStateQuery,
  );
  const usersFromBq = await queryFromBq(usersFromBqQuery);
  const users = sortUsersActiveState(usersFromBq);
  const con = await createOrGetConnection();

  await syncSubscriptionsWithActiveState({
    con,
    users,
  });
  await setRedisObject(SUCCESSFUL_CIO_SYNC_DATE, runDate.toISOString());

  process.exit(0);
};

func();
