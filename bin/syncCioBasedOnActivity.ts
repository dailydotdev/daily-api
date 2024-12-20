import createOrGetConnection from '../src/db';
import { syncValidateActiveUsersCron } from '../src/cron/validateActiveUsers';

const func = async () => {
  const con = await createOrGetConnection();

  await syncValidateActiveUsersCron(con);

  process.exit(0);
};

func();
