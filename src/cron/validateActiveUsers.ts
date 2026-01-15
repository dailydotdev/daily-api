import { Cron } from './cron';
import {
  getAbsoluteDifferenceInDays,
  isProd,
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

const cron: Cron = {
  name: 'validate-active-users',
  handler: async (con) => {
    if (isProd) {
      // currently skip in prod until new resting query and logic is implemented and tested
      return;
    }

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

    for (let i = 1; i <= difference; i++) {
      await runSync(con, addDays(lastRunDate, i));
    }
  },
};

export default cron;
