import fastq from 'fastq';
import '../src/config';
import { Post } from '../src/entity';
import { downloadFile } from '../src/common/googleCloud';
import { readdir, readFile, writeFile } from 'fs/promises';
import createOrGetConnection from '../src/db';
import path from 'path';
import { PostCodeSnippetJsonFile } from '../src/types';
import { insertCodeSnippets } from '../src/common/post';

type SnippetRow = { postId: string; filePath: string };

enum BinInsertCodeSnippetOperation {
  Download = 'download',
  Insert = 'insert',
}

const main = async () => {
  const queueConcurrency = +process.env.QUEUE_CONCURRENCY || 1;
  const operation = process.argv[2];
  const savePath = process.argv[3];

  if (
    !Object.values(BinInsertCodeSnippetOperation).includes(
      operation as BinInsertCodeSnippetOperation,
    )
  ) {
    throw new Error(`Invalid operation: ${operation}`);
  }

  if (!savePath) {
    throw new Error('Path is required');
  }

  const con = await createOrGetConnection();

  if (operation === BinInsertCodeSnippetOperation.Download) {
    const stream = await con
      .getRepository(Post)
      .createQueryBuilder()
      .select('id', 'postId')
      .addSelect(`"contentMeta"->>'stored_code_snippets'`, 'filePath')
      .where(`("contentMeta"->>'stored_code_snippets') is not null`)
      .stream();

    let downloadCount = 0;

    const downloadQueue = fastq.promise(
      async ({ postId, filePath }: SnippetRow) => {
        const result = await downloadFile({ url: filePath });
        await writeFile(path.join(savePath, `${postId}.json`), result);

        downloadCount += 1;
      },
      queueConcurrency,
    );

    stream.on('data', ({ postId, filePath }: SnippetRow) => {
      downloadQueue.push({ postId, filePath });
    });

    await new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('end', resolve);
    });
    await downloadQueue.drained();

    console.log('download finished with a total of: ', downloadCount);
    process.exit();
  }

  const dirList = await readdir(savePath, { withFileTypes: true });
  const files = dirList
    .filter((dirent) => dirent.isFile())
    .map((dirent) => dirent.name);

  let insertCount = 0;

  const insertQueue = fastq.promise(
    async ({ postId, filePath }: SnippetRow) => {
      const fileContent = await readFile(filePath, 'utf-8');
      const codeSnippetsJson = JSON.parse(
        fileContent,
      ) as PostCodeSnippetJsonFile;

      await insertCodeSnippets({
        entityManager: con.manager,
        post: {
          id: postId,
        },
        codeSnippetsJson,
      });

      insertCount += 1;
    },
    queueConcurrency,
  );

  files.forEach((file) => {
    const [postId] = file.split('.');

    insertQueue.push({ postId, filePath: path.join(savePath, file) });
  });

  await insertQueue.drained();

  console.log('insertion finished with a total of: ', insertCount);
  process.exit();
};

main();
