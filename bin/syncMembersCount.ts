import fastq from 'fastq';
import '../src/config';
import createOrGetConnection from '../src/db';
import { Source, SourceMember, SquadSource } from '../src/entity';
import { updateFlagsStatement } from '../src/common';

interface Result {
  sourceId: string;
  count: number;
}

const QUEUE_CONCURRENCY = 1;

(async () => {
  const con = await createOrGetConnection();
  await con.transaction(async (manager) => {
    console.log('initializing stream');
    const builder = manager
      .getRepository(SourceMember)
      .createQueryBuilder('sm')
      .select('COUNT(sm.*)', 'count')
      .addSelect('sm."sourceId"')
      .innerJoin(Source, 's', 's.id = sm."sourceId"')
      .where(`sm.role != 'blocked'`)
      .andWhere(`sm."sourceId" IS NOT NULL`)
      .andWhere(
        `COALESCE((s.flags->>'totalMembers')::integer, 0) != COUNT(sm.*)`,
      )
      .limit(1000)
      .groupBy('sm."sourceId"');

    const stream = await builder.stream();

    let insertCount = 0;
    const insertQueue = fastq.promise(async ({ sourceId, count }: Result) => {
      await manager
        .getRepository(SquadSource)
        .update(
          { id: sourceId },
          { flags: updateFlagsStatement<Source>({ totalMembers: count }) },
        );

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
