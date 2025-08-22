import fastq from 'fastq';
import '../src/config';
import createOrGetConnection from '../src/db';
import { User } from '../src/entity/user/User';

const QUEUE_CONCURRENCY = 1;

(async (): Promise<void> => {
  const limitArgument = process.argv[2];
  const offsetArgument = process.argv[3];

  if (!limitArgument || !offsetArgument) {
    throw new Error('limit and offset arguments are required');
  }

  const limit = +limitArgument;
  if (Number.isNaN(limit)) {
    throw new Error('limit argument is invalid, it should be a number');
  }

  const offset = +offsetArgument;
  if (Number.isNaN(offset)) {
    throw new Error('offset argument is invalid, it should be a number');
  }

  const con = await createOrGetConnection();

  try {
    console.log(
      `Processing users starting from offset ${offset} (limit ${limit})...`,
    );

    let processedCount = 0;

    await con.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);

      const builder = userRepo
        .createQueryBuilder('user')
        .select('user.id', 'id')
        .where('user.acceptedMarketing = false')
        .orderBy('user.createdAt')
        .limit(limit)
        .offset(offset);

      const stream = await builder.stream();

      const updateQueue = fastq.promise(async (userId: string) => {
        await manager.query(
          `UPDATE public.user 
           SET "notificationFlags" = jsonb_set(
             "notificationFlags",
             '{marketing}', 
             '{"email":"muted","inApp":"muted"}'::jsonb,
             true
           )
           WHERE id = $1 
           AND "acceptedMarketing" = false
           AND ("notificationFlags"->'marketing' IS NULL 
                OR "notificationFlags"->'marketing'->>'email' != 'muted')`,
          [userId],
        );

        processedCount++;
      }, QUEUE_CONCURRENCY);

      stream.on('data', (user: { id: string }) => {
        updateQueue.push(user.id);
      });

      await new Promise((resolve, reject) => {
        stream.on('error', reject);
        stream.on('end', () => resolve(true));
      });
      await updateQueue.drained();
    });

    console.log(
      `Migration completed successfully. Updated ${processedCount} users (offset ${offset} to ${offset + processedCount - 1}).`,
    );
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }

  process.exit(0);
})();
