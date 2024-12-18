import { Storage, DownloadOptions } from '@google-cloud/storage';
import { PropsParameters } from '../types';
import path from 'path';
import { BigQuery } from '@google-cloud/bigquery';
import { Query } from '@google-cloud/bigquery/build/src/bigquery';

export const downloadFile = async ({
  url,
  options,
}: {
  url: string;
  options?: DownloadOptions;
}): Promise<string> => {
  const bucket = path.dirname(url);
  const fileName = path.basename(url);
  const storage = new Storage();

  const [result] = await storage
    .bucket(bucket)
    .file(fileName)
    .download(options);

  return result.toString();
};

export const downloadJsonFile = async <T>({
  url,
  options,
}: PropsParameters<typeof downloadFile>): Promise<T> => {
  const result = await downloadFile({ url, options });

  return JSON.parse(result);
};

export const userActiveStateQuery = `
  with d as (
    select uss.primary_user_id,
    min(last_app_timestamp) as last_app_timestamp,
    min(registration_timestamp) as registration_timestamp,

      min(
        case when period_end between date('2024-12-07' - interval 6*7 day) and '2024-12-07' then '1. active_last_6w'
          when period_end between date('2024-12-07' - interval 12*7 day) and date('2024-12-07' - interval 6*7 + 1 day) then '2. active_7w_12w'
          when date(u.last_app_timestamp) <  date('2024-12-07' - interval 12*7 day) then '3. active_12w+'
          when date(u.registration_timestamp) <  date('2024-12-07' - interval 12*7 day) then '3. active_12w+'
          else '4. never_active' end
      ) as previous_state,

      min(
        case when period_end between date('2024-12-08' - interval 6*7 day) and '2024-12-08' then '1. active_last_6w'
            when period_end between date('2024-12-08' - interval 12*7 day) and date('2024-12-08' - interval 6*7 + 1 day) then '2. active_7w_12w'
            when date(u.last_app_timestamp) <  date('2024-12-08' - interval 12*7 day) then '3. active_12w+'
            when date(u.registration_timestamp) <  date('2024-12-08' - interval 12*7 day) then '3. active_12w+'
            else '4. never_active' end
      ) as current_state,


    from analytics.user as u
    left join analytics.user_state_sparse as uss on uss.primary_user_id = u.primary_user_id
      and uss.period_end between date('2024-12-07' - interval 12* 7 day) and '2024-12-08'
      and uss.period = 'daily'
      and uss.app_active_state = 'active'
      and uss.registration_state = 'registered'
    where u.registration_timestamp is not null
    and u.last_app_timestamp is not null
    and u.is_spam = false
    group by 1
  )
  --  select previous_state, current_state, count(*) as ctr
  --  from d
  --  where current_state != previous_state
  --  group by 1,2
  --  order by 1,2

  select *
  from d
  where previous_state != current_state
`;

interface GetUsersActiveState {
  inactiveUsers: string[];
  downgradeUsers: string[];
  reactivateUsers: string[];
}

interface UserActiveState {
  current_state: string;
  previous_state: string;
  primary_user_id: string;
}

const bigquery = new BigQuery();

export const queryFromBq = async (
  query: string,
): Promise<UserActiveState[]> => {
  const options: Query = { query };

  const [job] = await bigquery.createQueryJob(options);
  const [rows] = await job.getQueryResults();

  return rows;
};

export const getUsersActiveState = async (): Promise<GetUsersActiveState> => {
  const usersFromBq = await queryFromBq(userActiveStateQuery);
  const inactiveUsers: string[] = [];
  const downgradeUsers: string[] = [];
  const reactivateUsers: string[] = [];

  // sort users from bq into active, inactive, downgrade, and reactivate
  for (const user of usersFromBq) {
    if (
      user.current_state.includes('active_7w_12w') &&
      user.previous_state.includes('active_last_6w')
    ) {
      downgradeUsers.push(user.primary_user_id);
    } else if (
      user.current_state.includes('active_last_6w') &&
      !user.previous_state.includes('active_last_6w')
    ) {
      reactivateUsers.push(user.primary_user_id);
    } else if (
      (user.current_state.includes('active_12w+') &&
        !user.previous_state.includes('active_12w+')) ||
      (user.current_state.includes('never_active') &&
        !user.previous_state.includes('never_active'))
    ) {
      inactiveUsers.push(user.primary_user_id);
    }
  }

  return { inactiveUsers, downgradeUsers, reactivateUsers };
};
