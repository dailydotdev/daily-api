import '../src/config';
import createOrGetConnection from '../src/db';
import { Alerts, User } from '../src/entity';

(async () => {
  const con = await createOrGetConnection();
  const stream = await con
    .getRepository(User)
    .createQueryBuilder()
    .select('id')
    .where('id NOT IN (SELECT "userId" FROM public.alerts)')
    .stream();

  stream.on('data', async ({ id }: { id: string }) => {
    console.log('inserting alerts for: ', id);
    await con
      .getRepository(Alerts)
      .createQueryBuilder()
      .insert()
      .values({ userId: id })
      .orIgnore()
      .execute();
    console.log('alerts created for: ', id);
  });

  await new Promise((resolve, reject) => {
    stream.on('error', reject);
    stream.on('end', () => {
      console.log('stream finished');
      resolve(null);
      process.exit();
    });
  });
})();
