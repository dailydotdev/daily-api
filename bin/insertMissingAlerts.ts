import '../src/config';
import createOrGetConnection from '../src/db';
import { Alerts, ALERTS_DEFAULT, User } from '../src/entity';

export const insertMissingAlerts = async () => {
  const con = await createOrGetConnection();
  const users = await con
    .getRepository(User)
    .createQueryBuilder()
    .select('id')
    .where('id NOT IN (SELECT "userId" FROM public.alerts)')
    .execute();

  await con
    .getRepository(Alerts)
    .save(users.map(({ id }) => ({ ...ALERTS_DEFAULT, userId: id })));
};

insertMissingAlerts();
