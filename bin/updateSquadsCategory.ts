import '../src/config';
import createOrGetConnection from '../src/db';
import { SquadSource } from '../src/entity';
import { SourceCategory } from '../src/entity/sources/SourceCategory';
import { categorizedSquads } from './categorizedSquads';
import { In } from 'typeorm';
import { runInQueueStream } from './common';

interface Result {
  title: string;
  id: string;
}

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
      .addSelect('sc.id', 'id')
      .where('sc.title IN (:...categories)', {
        categories: categorizedSquads.map(({ category }) => category),
      });

    const stream = await builder.stream();

    await runInQueueStream<Result>(stream, async ({ title, id }: Result) => {
      const categorized = categorizedSquads
        .filter(({ category }) => category === title)
        .map(({ handle }) => handle);

      await manager
        .getRepository(SquadSource)
        .update({ handle: In(categorized) }, { categoryId: id });
    });
  });

  process.exit();
})();
