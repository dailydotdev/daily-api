import fastq from 'fastq';
import '../src/config';
import createOrGetConnection from '../src/db';
import { User, Alerts } from '../src/entity';

interface Result {
  userId: string;
  createdAt: Date;
}

const QUEUE_CONCURRENCY = 1;

(async () => {
  const con = await createOrGetConnection();
  await con.transaction(async (manager) => {
    console.log('initializing stream');
    const stream = await manager
      .getRepository(User)
      .createQueryBuilder('u')
      .select('u."createdAt"', 'createdAt')
      .addSelect('u.id', 'userId')
      .innerJoin(Alerts, 'a', 'u.id = a."userId"')
      .where(`a."lastFeedSettingsFeedback"::date <> u."createdAt"::date`)
      .stream();

    let insertCount = 0;
    const insertQueue = fastq.promise(async ({ userId, createdAt }: Result) => {
      await manager
        .getRepository(Alerts)
        .update({ userId }, { lastFeedSettingsFeedback: createdAt });

      insertCount += 1;
    }, QUEUE_CONCURRENCY);

    stream.on('data', (result: Result) => {
      insertQueue.push(result);
    });

    await new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('end', resolve);
    });
    await insertQueue.drained();
    console.log('update finished with a total of: ', insertCount);
  });

  process.exit();
})();
