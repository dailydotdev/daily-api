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
    const processingDate = subDays(new Date(), 1);

    if (!lastSuccessfulDate) {
      return runCron(con, processingDate);
    }

    const lastRunDate = new Date(lastSuccessfulDate);
    const difference = getAbsoluteDifferenceInDays(lastRunDate, processingDate);

    if (difference === 0) {
      return;
    }

    for (let i = 1; i <= difference; i++) {
      await runCron(con, addDays(lastRunDate, i));
    }
  },
};

export default cron;
