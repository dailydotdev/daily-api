import fastq from 'fastq';
import '../src/config';
import createOrGetConnection from '../src/db';
import { Post } from '../src/entity';
import { insertCodeSnippets } from '../src/common/post';

type SnippetRow = { postId: string; filePath: string };

const main = async () => {
  const queueConcurrency = +process.env.QUEUE_CONCURRENCY || 1;
  const con = await createOrGetConnection();

  const stream = await con
    .getRepository(Post)
    .createQueryBuilder()
    .select('id', 'postId')
    .addSelect(`"contentMeta"->>'stored_code_snippets'`, 'filePath')
    .where(`("contentMeta"->>'stored_code_snippets') is not null`)
    .stream();

  let insertCount = 0;

  const insertQueue = fastq.promise(
    async ({ postId, filePath }: SnippetRow) => {
      await insertCodeSnippets({
        entityManager: con.manager,
        post: {
          id: postId,
        },
        codeSnippetsUrl: filePath,
      });

      insertCount += 1;
    },
    queueConcurrency,
  );

  stream.on('data', ({ postId, filePath }: SnippetRow) => {
    insertQueue.push({ postId, filePath });
  });

  await new Promise((resolve, reject) => {
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  await insertQueue.drained();

  console.log('insertion finished with a total of: ', insertCount);
  process.exit();
};

main();
