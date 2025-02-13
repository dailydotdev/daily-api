import '../src/config';
import { Comment } from '../src/entity';
import { markdown } from '../src/common/markdown';
import createOrGetConnection from '../src/db';

interface Row {
  id: string;
  content: string;
}

(async (): Promise<void> => {
  const con = await createOrGetConnection();

  const resStream = await con
    .createQueryBuilder()
    .select('id, content')
    .from(Comment, 'c')
    .where('c."contentHtml" is NULL')
    .stream();

  let index = 0;
  resStream.on('data', async ({ id, content }: Row) => {
    console.log(`updating ${index}`);
    index++;

    await con
      .createQueryBuilder()
      .update(Comment)
      .set({ contentHtml: markdown.render(content) })
      .where({ id })
      .execute();
  });
  await new Promise((resolve, reject) => {
    resStream.on('error', reject);
    resStream.on('end', () => resolve(true));
  });
})();
