import fastq from 'fastq';
import '../src/config';
import createOrGetConnection from '../src/db';
import { Post, Source, SquadSource } from '../src/entity';
import { updateFlagsStatement } from '../src/common';

interface Result {
  sourceId: string;
  count: number;
  views: number;
  upvotes: number;
}

const QUEUE_CONCURRENCY = 1;

(async () => {
  const con = await createOrGetConnection();
  await con.transaction(async (manager) => {
    console.log('initializing stream');
    const stream = await manager
      .getRepository(Post)
      .createQueryBuilder('p')
      .select('COUNT(p.*)', 'count')
      .addSelect('SUM(p.views)', 'views')
      .addSelect('SUM(p.upvotes)', 'upvotes')
      .addSelect('s.id', 'sourceId')
      .innerJoin(SquadSource, 's', 's.id = p."sourceId"')
      .where(`s.type = 'machine'`)
      .groupBy('s.id')
      .stream();

    let insertCount = 0;
    const insertQueue = fastq.promise(
      async ({ sourceId, views, upvotes, count }: Result) => {
        await manager.getRepository(SquadSource).update(
          { id: sourceId },
          {
            flags: updateFlagsStatement<Source>({
              totalViews: views,
              totalUpvotes: upvotes,
              totalPosts: count,
            }),
          },
        );

        insertCount += 1;
      },
      QUEUE_CONCURRENCY,
    );

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
