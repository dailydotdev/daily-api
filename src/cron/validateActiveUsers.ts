import { Cron } from './cron';
import {
  getAbsoluteDifferenceInDays,
  SUCCESSFUL_CIO_SYNC_DATE,
  syncSubscriptionsWithActiveState,
} from '../common';
import { getUsersActiveState } from '../common/googleCloud';
import { getRedisObject, setRedisObject } from '../redis';
import { DataSource } from 'typeorm';
import { addDays } from 'date-fns';

const runCron = async (con: DataSource, runDate: Date) => {
  const users = await getUsersActiveState(runDate);

  await syncSubscriptionsWithActiveState({
    con,
    users,
  });
  await setRedisObject(SUCCESSFUL_CIO_SYNC_DATE, runDate.toISOString());
};

const cron: Cron = {
  name: 'validate-active-users',
  handler: async (con) => {
    const lastSuccessfulDate = await getRedisObject(SUCCESSFUL_CIO_SYNC_DATE);

    if (!lastSuccessfulDate) {
      return runCron(con, new Date());
    }

    const lastRunDate = new Date(lastSuccessfulDate);
    const runDate = new Date();
    const difference = getAbsoluteDifferenceInDays(lastRunDate, runDate);

    if (difference === 0) {
      return;
    }

    for (let i = 1; i <= difference; i++) {
      await runCron(con, addDays(lastRunDate, i));
    }
  },
};

export default cron;
