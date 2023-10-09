import '../src/config';
import createOrGetConnection from '../src/db';
import fs from 'fs';
import { parse } from 'csv-parse';

(async (): Promise<void> => {
  const csvFilePath = process.argv[2];
  const splitBy = process.argv[3] || ',';

  if (!csvFilePath) {
    throw new Error('CSV file path is required');
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
    await manager.query(`
        INSERT INTO user_personalized_digest ("userId", "preferredTimezone")
        SELECT id AS "userId", COALESCE(timezone, 'Etc/UTC') AS "preferredTimezone" FROM public.user WHERE id IN (${userIds
          .map((userId) => `'${userId}'`)
          .filter(Boolean)
          .join(',')}) ON CONFLICT DO NOTHING;
      `);
  });

  process.exit();
})();
