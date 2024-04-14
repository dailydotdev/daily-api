import '../src/config';
import createOrGetConnection from '../src/db';
import fs from 'fs';
import { parse } from 'csv-parse';
import { Keyword } from '../src/entity/Keyword';

(async (): Promise<void> => {
  const csvFilePath = process.argv[2];
  const batch = +process.argv[3] || 100;
  const splitBy = process.argv[4] || ',';

  if (!csvFilePath) {
    throw new Error('CSV file path is required');
  }
  const keywords: Partial<Keyword>[] = [];

  console.log('reading csv file', csvFilePath);

  const stream = fs
    .createReadStream(csvFilePath)
    .pipe(parse({ delimiter: splitBy, from_line: 2 }));

  stream.on('error', (err) => {
    console.error('failed to read file: ', err.message);
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  stream.on('data', function ([slug, url, title, description]) {
    if (!slug || !description) {
      return;
    }

    keywords.push({
      value: slug,
      flags: {
        title,
        description,
      },
    });
  });

  await new Promise((resolve) => {
    stream.on('end', resolve);
  });

  console.log('running db query');

  const con = await createOrGetConnection();

  for (let i = 0; i < keywords.length; i += batch) {
    await con.transaction(async (manager) => {
      const keywordsBatch = keywords.slice(i, i + batch);

      console.log('processing batch', i, 'of', keywords.length);

      for (const keyword of keywordsBatch) {
        await manager.query(
          `
            UPDATE keyword
            SET flags = flags || $1
            WHERE value = $2
          `,
          [JSON.stringify(keyword.flags), keyword.value],
        );
      }
    });
  }

  process.exit();
})();
