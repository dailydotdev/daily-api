import '../src/config';
import createOrGetConnection from '../src/db';
import fs from 'fs';
import { parse } from 'csv-parse';

(async (): Promise<void> => {
  const csvFilePath = process.argv[2];
  const variationArgument = process.argv[3];
  const batch = +process.argv[4] || 100;
  const splitBy = process.argv[5] || ',';

  if (!csvFilePath) {
    throw new Error('CSV file path is required');
  }

  const variation = +variationArgument;

  if (Number.isNaN(variation) || variation < 1) {
    throw new Error(
      'variation argument is invalid, it should be positive number',
    );
  }

  const userIds: string[] = [];

  console.log('reading csv file', csvFilePath);

  const stream = fs
    .createReadStream(csvFilePath)
    .pipe(parse({ delimiter: splitBy, from_line: 2 }));

  stream.on('error', (err) => {
    console.error('failed to read file: ', err.message);
  });

  stream.on('data', function ([userId]) {
    if (!userId) {
      return;
    }

    userIds.push(userId);
  });

  await new Promise((resolve) => {
    stream.on('end', resolve);
  });

  console.log('running db query');

  const con = await createOrGetConnection();

  await con.transaction(async (manager) => {
    for (let i = 0; i < userIds.length; i += batch) {
      const userIdsBatch = userIds.slice(i, i + batch);

      console.log('processing batch', i, 'of', userIds.length);

      await manager.query(
        `
          UPDATE user_personalized_digest
          SET variation = $1
          WHERE "userId" IN (${userIdsBatch
            .map((userId) => `'${userId}'`)
            .filter(Boolean)
            .join(',')});
        `,
        [variation],
      );
    }
  });

  process.exit();
})();
