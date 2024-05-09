import '../src/config';
import createOrGetConnection from '../src/db';
import fs from 'fs';
import { parse } from 'csv-parse';
import { Source } from '../src/entity';

(async (): Promise<void> => {
  const csvFilePath = process.argv[2];
  const batch = +process.argv[3] || 100;
  const splitBy = process.argv[4] || ',';

  if (!csvFilePath) {
    throw new Error('CSV file path is required');
  }
  const items: Partial<Source>[] = [];

  console.log('reading csv file', csvFilePath);

  const stream = fs
    .createReadStream(csvFilePath)
    .pipe(parse({ delimiter: splitBy, from_line: 2 }));

  stream.on('error', (err) => {
    console.error('failed to read file: ', err.message);
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  stream.on('data', function ([id, description]) {
    if (!id || !description) {
      return;
    }

    items.push({
      id,
      description,
    });
  });

  await new Promise((resolve) => {
    stream.on('end', resolve);
  });

  console.log('running db query');

  const con = await createOrGetConnection();

  for (let i = 0; i < items.length; i += batch) {
    await con.transaction(async (manager) => {
      const itemsBatch = items.slice(i, i + batch);

      console.log('processing batch', i, 'of', items.length);

      for (const item of itemsBatch) {
        await manager.query(
          `
            UPDATE source
            SET description = $1
            WHERE id = $2 OR handle = $2
          `,
          [item.description, item.id],
        );
      }
    });
  }

  process.exit();
})();
