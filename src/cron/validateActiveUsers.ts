import { Cron } from './cron';
import {
  getAbsoluteDifferenceInDays,
  SUCCESSFUL_CIO_SYNC_DATE,
  syncSubscriptionsWithActiveState,
} from '../common';
import { getUsersActiveState } from '../common/googleCloud';
import { getRedisObject, setRedisObject } from '../redis';
import { DataSource } from 'typeorm';
import { addDays, subDays } from 'date-fns';

const runSync = async (con: DataSource, runDate: Date) => {
  const users = await getUsersActiveState(runDate);

  const { hasAnyFailed } = await syncSubscriptionsWithActiveState({
    con,
    users,
  });

  if (!hasAnyFailed) {
    await setRedisObject(SUCCESSFUL_CIO_SYNC_DATE, runDate.toISOString());
  }
};

export const syncValidateActiveUsersCron = async (con: DataSource) => {
  const runDate = subDays(new Date(), 1);
  const lastSuccessfulDate = await getRedisObject(SUCCESSFUL_CIO_SYNC_DATE);

  if (!lastSuccessfulDate) {
    return runSync(con, runDate);
  }

  const lastRunDate = new Date(lastSuccessfulDate);
  const difference = getAbsoluteDifferenceInDays(lastRunDate, runDate);

  if (difference === 0) {
    return;
  }

  for (let i = 1; i <= difference || i > 100; i++) {
    await runSync(con, addDays(lastRunDate, i));
  }
};

const cron: Cron = {
  name: 'validate-active-users',
  handler: async (con) => {
    await syncValidateActiveUsersCron(con);
  },
};

export default cron;
