import '../src/config';
import { createOrGetConnection } from '../src/db';
import { Alerts } from '../src/entity';

interface Row {
  id: string;
}

(async (): Promise<void> => {
  const con = await createOrGetConnection();

  const resStream = await con
    .createQueryBuilder()
    .select('id')
    .from(Alerts, 'a')
    .where('a."filter" is false')
    .stream();

  let index = 0;
  resStream.on('data', async ({ id }: Row) => {
    console.log(`updating ${index}`);
    index++;

    await con
      .createQueryBuilder()
      .update(Alerts)
      .set({ myFeed: 'migrated' })
      .where({ id })
      .execute();
  });
  await new Promise((resolve, reject) => {
    resStream.on('error', reject);
    resStream.on('end', resolve);
  });
})();
