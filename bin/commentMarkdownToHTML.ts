import '../src/config';
import { createOrGetConnection } from '../src/db';
import { Comment } from '../src/entity';
import { markdown } from '../src/common/markdown';

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
    .where('c."content_html" is NULL')
    .limit(50000)
    .stream();

  let index = 0;
  resStream.on('data', async ({ id, content }: Row) => {
    console.log(`updating ${index}`);
    index++;

    await con
      .createQueryBuilder()
      .update(Comment)
      .set({ content_html: markdown.render(content) })
      .where({ id })
      .execute();
  });
  await new Promise((resolve, reject) => {
    resStream.on('error', reject);
    resStream.on('end', resolve);
  });
})();
