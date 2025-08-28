/*

Runs ClickHouse migrations from clickhouse/migrations.
- Discovers migrations named: {id}_{snake_case_name}.{up|down}.sql
- Records migration as dirty in the migrations_ch table on API
- Executes pending *.up.sql in ascending id order
- If any up fails blocks further execution
- Records each applied up into migrations_ch table (id, name, timestamp, dirty)

*/

import '../src/config';
import fs from 'node:fs';
import path from 'node:path';
import { getClickHouseClient } from '../src/common/clickhouse';
import { logger } from '../src/logger';
import {
  clickhouseMigrationFilenameMatch,
  clickhouseMigrationsDir,
} from '../src/types';
import createOrGetConnection from '../src/db';
import type { DataSource } from 'typeorm';
import { ChMigration } from '../src/entity/ChMigration';
import { isProd } from '../src/common';

type Migration = {
  id: number;
  name: string;
  upPath: string;
  downPath: string;
};

type MigrationPair = Pick<Migration, 'id' | 'name'> &
  Partial<Pick<Migration, 'upPath' | 'downPath'>>;

const main = async () => {
  const client = getClickHouseClient();
  const con = await createOrGetConnection();

  try {
    const applied = await getAppliedMigrations(con);
    const appliedIds = new Set(applied.map((m) => m.id.toString()));

    const migrations = discoverMigrations(
      path.join(isProd ? '/opt/app' : process.cwd(), clickhouseMigrationsDir),
    ).sort((a, b) => a.id - b.id);

    const hasDirtyMigrations = applied.some((m) => m.dirty);

    if (hasDirtyMigrations) {
      throw new Error(
        'Some migrations are marked as dirty. Please resolve manually and update their state in migrations_ch table',
      );
    }

    const pendingMigrations = migrations.filter(
      (m) => !appliedIds.has(m.id.toString()),
    );

    if (pendingMigrations.length === 0) {
      throw new Error('No pending migrations');
    }

    logger.info(`Found ${pendingMigrations.length} pending migration(s).`);

    for (const migration of pendingMigrations) {
      logger.info(`Applying migration ${migration.id}_${migration.name}`);

      try {
        await recordMigration(con, migration.id, migration.name, true); // record migration as dirty

        await runMigrationFile(client, migration.upPath);

        await recordMigration(con, migration.id, migration.name, false); // record after success
      } catch (originalError) {
        const error = originalError as Error;

        logger.error(
          `Failed migration ${migration.id}_${migration.name}: ${error.message} ❌`,
        );

        throw new Error('Some migrations failed ❌');
      }
    }

    logger.info('All pending migrations applied successfully. 🎉');
  } catch (originalError) {
    const error = originalError as Error;

    if (error.message === 'No pending migrations') {
      logger.info(`No pending migrations found. ✅`);
    } else {
      logger.error(`Migration error: ${error.message || error.name}`);
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

const getAppliedMigrations = async (
  con: DataSource,
): Promise<ChMigration[]> => {
  return await con.getRepository(ChMigration).find();
};

const recordMigration = async (
  con: DataSource,
  id: number,
  name: string,
  dirty: boolean,
) => {
  await con.getRepository(ChMigration).save({
    id: id.toString(),
    name,
    dirty,
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
