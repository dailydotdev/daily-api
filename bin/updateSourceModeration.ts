import '../src/config';
import createOrGetConnection from '../src/db';
import { SquadSource } from '../src/entity';
import { runInQueueStream } from './common';

interface Result {
  title: string;
  id: string;
}

(async () => {
  const con = await createOrGetConnection();
  await con.transaction(async (manager) => {
    console.log('initializing stream');

    const builder = manager
      .getRepository(SquadSource)
      .createQueryBuilder('ss')
      .select('ss.id', 'id')
      .where('ss."memberPostingRank" = 0');

    const stream = await builder.stream();

    await runInQueueStream<Result>(stream, async ({ id }: Result) => {
      await manager
        .getRepository(SquadSource)
        .update({ id }, { moderationRequired: true });
    });
  });

  process.exit();
})();
