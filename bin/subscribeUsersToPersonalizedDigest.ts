import '../src/config';
import createOrGetConnection from '../src/db';
import fs from 'fs/promises';

const parseCSV = <T>(csv: string, splitBy: string): T[] => {
  const [heading, ...rows] = csv.split(/\r?\n/).filter(Boolean);
  const columns = heading.split(splitBy).map((item) => item.replace(/"/g, ''));

  return rows.map((row) => {
    const rowData = row.split(splitBy).map((item) => item.replace(/"/g, ''));

    if (rowData.length !== columns.length) {
      throw new Error(`Invalid CSV, row should have ${columns.length} columns`);
    }

    return rowData.reduce((acc, rowValue, index) => {
      const name = columns[index];

      if (name) {
        acc[name] = rowValue;
      }

      return acc;
    }, {});
  }) as T[];
};

(async (): Promise<void> => {
  const csvFilePath = process.argv[2];
  const splitBy = process.argv[3] || ',';

  if (!csvFilePath) {
    throw new Error('CSV file path is required');
  }

  const csvFile = await fs.readFile(csvFilePath, 'utf-8');

  const users = parseCSV<{ user_id?: string }>(csvFile, splitBy);

  const con = await createOrGetConnection();

  await con.transaction(async (manager) => {
    await manager.query(`
        INSERT INTO user_personalized_digest ("userId", "preferredTimezone")
        SELECT id AS "userId", COALESCE(timezone, 'Etc/UTC') AS "preferredTimezone" FROM public.user WHERE id IN (${users
          .map((item) => (item.user_id ? `'${item.user_id}'` : null))
          .filter(Boolean)
          .join(',')}) ON CONFLICT DO NOTHING;
      `);
  });

  process.exit();
})();
