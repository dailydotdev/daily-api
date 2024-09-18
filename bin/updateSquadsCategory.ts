import fastq from 'fastq';
import '../src/config';
import createOrGetConnection from '../src/db';
import { Source, SourceMember, SquadSource } from '../src/entity';
import { updateFlagsStatement } from '../src/common';
import { SourceCategory } from '../src/entity/sources/SourceCategory';
import { categorizedSquads } from './categorizedSquads';
import { In } from 'typeorm';

interface Result {
  title: string;
  id: string;
}

const QUEUE_CONCURRENCY = 1;

(async () => {
  const con = await createOrGetConnection();
  await con.transaction(async (manager) => {
    console.log('initializing stream');
    const categories = await manager.getRepository(SourceCategory).find();

    const unfound = [];
    categorizedSquads.forEach(({ category }) => {
      const isFound = categories.find(({ title }) => title === category);
      if (!isFound) {
        unfound.push(category);
      }
      return isFound;
    });

    if (unfound.length > 0) {
      console.log('Unfound categories: ', unfound);
      return;
    }

    const builder = manager
      .getRepository(SourceCategory)
      .createQueryBuilder('sc')
      .select('sc.title', 'title')
      .addSelect('sc.id', 'id');

    const stream = await builder.stream();

    let insertCount = 0;
    const insertQueue = fastq.promise(async ({ title, id }: Result) => {
      const categorized = categorizedSquads
        .filter(({ category }) => category === title)
        .map(({ handle }) => handle);

      await manager
        .getRepository(SquadSource)
        .update({ handle: In(categorized) }, { categoryId: id });

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
