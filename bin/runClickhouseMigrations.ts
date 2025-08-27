//
// Runs ClickHouse migrations from clickhouse/migrations.
// - Discovers migrations named: {id}_{snake_case_name}.{up|down}.sql
// - Creates api.migrations table if missing
// - Executes pending *.up.sql in ascending id order
// - If any up fails: run its down (if present), then run down for all
//   migrations applied earlier in THIS run (reverse order) and
//   remove their records from api.migrations.
// - Records each applied up into api.migrations (id, name, timestamp)
//

import '../src/config';
import fs from 'node:fs';
import path from 'node:path';
import { getClickHouseClient } from '../src/common/clickhouse';
import z from 'zod';
import { logger } from '../src/logger';
import {
  clickhouseMigrationFilenameMatch,
  clickhouseMigrationsDir,
} from '../src/types';

type Migration = {
  id: number;
  name: string;
  upPath: string;
  downPath: string;
};

type MigrationPair = Pick<Migration, 'id' | 'name'> &
  Partial<Pick<Migration, 'upPath' | 'downPath'>>;

const migrationRowSchema = z.object({
  id: z.coerce.number(),
  name: z.string(),
  timestamp: z.string(),
});

const main = async () => {
  const client = getClickHouseClient();

  try {
    await ensureMigrationsTable(client);

    const applied = await getAppliedMigrations(client);
    const appliedIds = new Set(applied.map((m) => m.id.toString()));

    const migrations = discoverMigrations(clickhouseMigrationsDir).sort(
      (a, b) => a.id - b.id,
    );

    const pendingMigrations = migrations.filter(
      (m) => !appliedIds.has(m.id.toString()),
    );

    if (pendingMigrations.length === 0) {
      throw new Error('No pending migrations');
    }

    logger.info(`Found ${pendingMigrations.length} pending migration(s).`);

    // Track what we successfully apply in THIS run
    const appliedThisRun: Array<Migration> = [];

    for (const migration of pendingMigrations) {
      logger.info(`Applying migration ${migration.id}_${migration.name}`);

      try {
        await runMigrationFile(client, migration.upPath);
        await recordAppliedMigration(client, migration.id, migration.name); // record AFTER success

        appliedThisRun.push(migration);
      } catch (originalError) {
        const error = originalError as Error;

        logger.error(
          `Failed migration ${migration.id}_${migration.name}: ${error.message} ❌`,
        );

        try {
          logger.info(
            `Rolling back failed migration ${migration.id}_${migration.name}`,
          );

          await runMigrationFile(client, migration.downPath);
        } catch (originalError) {
          const rbErr = originalError as Error;

          logger.error(
            `Rollback (failed migration) error for ${migration.id}_${migration.name}: ${rbErr.message} ❌`,
          );
        }

        // 2) Roll back everything that succeeded earlier in this run (reverse order)
        if (appliedThisRun.length > 0) {
          logger.info(
            `Reverting ${appliedThisRun.length} previously applied migration(s) from this run`,
          );

          for (const done of [...appliedThisRun].reverse()) {
            try {
              logger.info(`Rolling back ${done.id}_${done.name}`);

              await runMigrationFile(client, done.downPath);
            } catch (originalError) {
              const rbErr = originalError as Error;

              logger.error(
                `Rollback error for ${done.id}_${done.name}: ${rbErr.message} ❌`,
              );
            }

            // 3) Clear its record from api.migrations
            try {
              await deleteMigrationRecord(client, done.id);
            } catch (originalError) {
              const delErr = originalError as Error;

              logger.error(
                `Failed to clear record for ${done.id}_${done.name}: ${delErr.message} ❌`,
              );
            }
          }
        }

        throw new Error('Some migrations failed ❌');
      }
    }

    logger.info('All pending migrations applied successfully. 🎉');
  } catch (originalError) {
    const error = originalError as Error;

    if (error.message === 'No pending migrations') {
      logger.info(`No pending migrations found. ✅`);
    } else {
      logger.error(`Fatal error: ${error.message || error.name}`);
    }
  } finally {
    await client.close();

    process.exit(1);
  }
};

const validateMigrations = (
  migrations: MigrationPair[],
): migrations is Migration[] => {
  return migrations.every((item) => item.upPath || item.downPath);
};

const discoverMigrations = (dir: string): Migration[] => {
  if (!fs.existsSync(dir)) {
    throw new Error(`Migrations directory not found: ${dir}`);
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const map = new Map<string, MigrationPair>();

  for (const item of entries) {
    if (!item.isFile()) continue;
    const fileMatch = item.name.match(clickhouseMigrationFilenameMatch);

    if (!fileMatch) {
      continue;
    }

    const [, idStr, name, kind] = fileMatch;
    const id = +idStr;
    const key = `${id}_${name}`;
    const full = path.join(dir, item.name);
    const prev = map.get(key) || { id, name };

    if (kind.toLowerCase() === 'up') {
      prev.upPath = full;
    }

    if (kind.toLowerCase() === 'down') {
      prev.downPath = full;
    }

    map.set(key, prev);
  }

  const migrations = Array.from(map.values());

  if (!validateMigrations(migrations)) {
    throw new Error('Some migrations are missing up or down files');
  }

  return migrations;
};

const ensureMigrationsTable = async (
  client: ReturnType<typeof getClickHouseClient>,
) => {
  await client.command({
    query: /* sql */ `
      CREATE DATABASE IF NOT EXISTS api
    `,
  });
  await client.command({
    query: /* sql */ `
      CREATE TABLE IF NOT EXISTS api.migrations
      (
        id UInt64,
        name String,
        timestamp DateTime64(3) DEFAULT now()
      )
      ENGINE = MergeTree
      ORDER BY id
    `,
  });
};

const getAppliedMigrations = async (
  client: ReturnType<typeof getClickHouseClient>,
): Promise<z.infer<typeof migrationRowSchema>[]> => {
  const response = await client.query({
    query: /* sql */ `
      SELECT id, name, timestamp
      FROM api.migrations
      ORDER BY id ASC
    `,
    format: 'JSONEachRow',
  });

  const result = z.array(migrationRowSchema).safeParse(await response.json());

  if (!result.success) {
    throw new Error(result.error.issues[0].message);
  }

  return result.data;
};

const recordAppliedMigration = async (
  client: ReturnType<typeof getClickHouseClient>,
  id: number,
  name: string,
) => {
  await client.command({
    query: /* sql */ `
      INSERT INTO api.migrations (id, name) VALUES ({id:String}, {name:String})
    `,
    query_params: { id: id.toString(), name },
  });
};

const deleteMigrationRecord = async (
  client: ReturnType<typeof getClickHouseClient>,
  id: number,
) => {
  await client.command({
    query: /* sql */ `
      ALTER TABLE api.migrations DELETE WHERE id = {id:String} SYNC
    `,
    query_params: {
      id: id.toString(),
    },
  });
};

const runMigrationFile = async (
  client: ReturnType<typeof getClickHouseClient>,
  fullPath: string,
) => {
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Migration file not found: ${fullPath}`);
  }

  const content = fs.readFileSync(fullPath, 'utf-8');

  const statements = content
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await client.command({ query: statement });
  }
};

main();
