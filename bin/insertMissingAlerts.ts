import '../src/config';
import createOrGetConnection from '../src/db';
import { Alerts, User } from '../src/entity';

export const insertMissingAlerts = async () => {
  const con = await createOrGetConnection();
  const usersQuery = con
    .getRepository(User)
    .createQueryBuilder()
    .select('id')
    .where('id NOT IN (SELECT "userId" FROM public.alerts)')
    .getQuery();

  await con
    .getRepository(Alerts)
    .query(`INSERT INTO public.alerts ("userId") ${usersQuery}`);
};

insertMissingAlerts();
