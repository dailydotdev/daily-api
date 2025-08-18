import fastq from 'fastq';
import '../src/config';
import createOrGetConnection from '../src/db';

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
      const digestRepo = manager.getRepository('UserPersonalizedDigest');

      const builder = digestRepo
        .createQueryBuilder('upd')
        .select('upd.userId', 'userId')
        .where('upd.type = :briefType')
        .andWhere('upd.flags ->> :emailFlag = :emailValue')
        .setParameters({
          briefType: 'brief',
          emailFlag: 'email',
          emailValue: 'true',
        })
        .orderBy('upd.userId')
        .limit(limit)
        .offset(offset);

      const stream = await builder.stream();

      const updateQueue = fastq.promise(async (userId: string) => {
        await manager.query(
          `UPDATE public.user 
           SET "notificationFlags" = jsonb_set("notificationFlags", '{briefing_ready,email}', '"subscribed"')
           WHERE id = $1
           AND "notificationFlags"->'briefing_ready'->>'email' = 'muted'`,
          [userId],
        );

        processedCount++;
      }, QUEUE_CONCURRENCY);

      stream.on('data', (digest: { userId: string }) => {
        updateQueue.push(digest.userId);
      });

      await new Promise((resolve, reject) => {
        stream.on('error', reject);
        stream.on('end', () => resolve(true));
      });
      await updateQueue.drained();
    });

    console.log(
      `Update was successful. Updated ${processedCount} users (offset ${offset} to ${offset + processedCount - 1}).`,
    );
  } catch (error) {
    console.error('Update failed:', error);
    throw error;
  }

  process.exit(0);
})();
