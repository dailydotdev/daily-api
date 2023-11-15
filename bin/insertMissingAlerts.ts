import fastq from 'fastq';
import '../src/config';
import createOrGetConnection from '../src/db';
import { Alerts, User } from '../src/entity';

const QUEUE_CONCURRENCY = 1;

(async () => {
  const con = await createOrGetConnection();
  const stream = await con
    .getRepository(User)
    .createQueryBuilder()
    .select('id')
    .where('id NOT IN (SELECT "userId" FROM public.alerts)')
    .stream();

  let insertCount = 0;
  const insertQueue = fastq.promise(async (id: string) => {
    console.log('inserting alerts for: ', id);
    await con
      .getRepository(Alerts)
      .createQueryBuilder()
      .insert()
      .values({ userId: id })
      .orIgnore()
      .execute();
    console.log('alerts created for: ', id);

    insertCount += 1;
  }, QUEUE_CONCURRENCY);

  stream.on('data', ({ id }: { id: string }) => {
    insertQueue.push(id);
  });

  await new Promise((resolve, reject) => {
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  await insertQueue.drained();
  console.log('insertion finished with a total of: ', insertCount);
  process.exit();
})();
