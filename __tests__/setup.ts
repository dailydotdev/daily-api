import * as matchers from 'jest-extended';
import { DataSource, QueryRunner } from 'typeorm';
import '../src/config';
import createOrGetConnection from '../src/db';
import { testSchema } from '../src/data-source';
import { remoteConfig } from '../src/remoteConfig';
import { loadAuthKeys } from '../src/auth';

expect.extend(matchers);

global.structuredClone = (v) => JSON.parse(JSON.stringify(v));

jest.mock('../src/growthbook', () => ({
  ...(jest.requireActual('../src/growthbook') as Record<string, unknown>),
  loadFeatures: jest.fn(),
  getEncryptedFeatures: jest.fn(),
}));

jest.mock('../src/remoteConfig', () => ({
  ...(jest.requireActual('../src/remoteConfig') as Record<string, unknown>),
  remoteConfig: {
    init: jest.fn(),
    vars: {
      vordrWordsPostTitle: ['spam', 'banned', 'forbidden'],
      vordrWords: [
        'vordrwillcatchyou',
        'andvordrwillhavefun',
        'and vordr will win',
      ],
      vordrIps: ['192.0.2.0/24', '198.51.100.0/24', '203.0.113.0/24'],
      ignoredWorkEmailDomains: ['igored.com', 'ignored.org'],
      rateLimitReputationThreshold: 1,
      pricingIds: { pricingGift: 'yearly' },
      fees: {
        transfer: 5,
      },
      coresRoleRules: [
        {
          regions: ['RS'],
          role: 1,
        },
      ],
      paddleTestDiscountIds: ['dsc_test'],
      paddleProductIds: {
        cores: 'pro_01jn6djzggt2cwharv1r3hv9as',
        plus: 'pro_01jcdn61rc967gqyscegtee0qm',
        organization: 'pro_01jvm22wepxc0x539bc4w6jybx',
        recruiter: 'pro_recruiter',
      },
    } as typeof remoteConfig.vars,
    validLanguages: {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      'zh-Hans': 'ChineseSimplified',
    },
    postRateLimit: 2,
  },
}));

/**
 * Replace hardcoded 'public.' schema references with the target schema.
 * This handles migrations that have explicit public schema references.
 * Also adds IF EXISTS to DROP statements for resilience.
 */
const replaceSchemaReferences = (sql: string, targetSchema: string): string => {
  if (targetSchema === 'public') return sql;

  let result = sql;

  // Handle DROP INDEX separately - remove schema qualification and add IF EXISTS
  // PostgreSQL indexes are found via search_path, schema qualification can cause issues
  result = result.replace(
    /DROP INDEX\s+(?:IF EXISTS\s+)?(?:"public"\.|public\.)?("[^"]+"|[\w]+)/gi,
    (_, indexName) => `DROP INDEX IF EXISTS ${indexName}`,
  );

  // Replace various patterns of public schema references
  result = result
    // public."table" -> "targetSchema"."table"
    .replace(/\bpublic\."(\w+)"/gi, `"${targetSchema}"."$1"`)
    // public.table -> "targetSchema"."table" (unquoted table names)
    .replace(/\bpublic\.(\w+)(?=[\s,;())]|$)/gi, `"${targetSchema}"."$1"`)
    // "public"."table" -> "targetSchema"."table"
    .replace(/"public"\."(\w+)"/gi, `"${targetSchema}"."$1"`)
    // ON public."table" -> ON "targetSchema"."table"
    .replace(/\bON\s+public\./gi, `ON "${targetSchema}".`);

  return result;
};

/**
 * Wrap a QueryRunner to intercept and transform SQL queries.
 * Replaces public schema references with the target schema.
 */
const wrapQueryRunner = (
  queryRunner: QueryRunner,
  targetSchema: string,
): QueryRunner => {
  const originalQuery = queryRunner.query.bind(queryRunner);

  queryRunner.query = async (
    query: string,
    parameters?: unknown[],
  ): Promise<unknown> => {
    const transformedQuery = replaceSchemaReferences(query, targetSchema);
    return originalQuery(transformedQuery, parameters);
  };

  return queryRunner;
};

// Tables that contain seed/reference data that should not be deleted between tests
// These are populated by migrations and tests don't modify them
// NOTE: Most tables are NOT included because tests create their own test data
// and expect tables to start empty (so auto-increment IDs start at 1)
const SEED_DATA_TABLES = new Set([
  'migrations', // Required by TypeORM to track applied migrations
  'checkpoint', // System checkpoints, tests don't create/modify
]);

const cleanDatabase = async (): Promise<void> => {
  await remoteConfig.init();

  const con = await createOrGetConnection();
  for (const entity of con.entityMetadatas) {
    const repository = con.getRepository(entity.name);
    if (repository.metadata.tableType === 'view') continue;

    // Skip seed data tables - they're populated once and tests expect them to exist
    if (SEED_DATA_TABLES.has(entity.tableName)) continue;

    await repository.query(`DELETE FROM "${entity.tableName}";`);

    for (const column of entity.primaryColumns) {
      if (column.generationStrategy === 'increment') {
        // Reset sequences/identity columns for auto-increment primary keys
        // Must use schema-qualified table name for schema isolation to work
        try {
          // First try pg_get_serial_sequence (works for SERIAL columns)
          // Schema-qualify the table name for proper resolution in worker schemas
          const schemaQualifiedTable = `${testSchema}.${entity.tableName}`;
          const seqResult = await repository.query(
            `SELECT pg_get_serial_sequence($1, $2) as seq_name`,
            [schemaQualifiedTable, column.databaseName],
          );
          if (seqResult[0]?.seq_name) {
            await repository.query(
              `ALTER SEQUENCE ${seqResult[0].seq_name} RESTART WITH 1`,
            );
          } else {
            // If no sequence found, try resetting IDENTITY column directly
            // This handles GENERATED AS IDENTITY columns
            await repository.query(
              `ALTER TABLE "${testSchema}"."${entity.tableName}" ALTER COLUMN "${column.databaseName}" RESTART WITH 1`,
            );
          }
        } catch {
          // Sequence/identity might not exist or not be resettable, ignore
        }
      }
    }
  }
};

export const fileTypeFromBuffer = jest.fn();
jest.mock('file-type', () => ({
  fileTypeFromBuffer: () => fileTypeFromBuffer(),
}));

/**
 * Create the worker schema for test isolation by running migrations.
 * This approach runs the actual migrations with schema references replaced,
 * ensuring exact parity with how the schema was built.
 */
const createWorkerSchema = async (): Promise<void> => {
  // Only create non-public schemas (when running with multiple Jest workers)
  if (testSchema === 'public') {
    return;
  }

  // First, create the schema using a bootstrap connection
  const bootstrapDataSource = new DataSource({
    type: 'postgres',
    host: process.env.TYPEORM_HOST || 'localhost',
    port: 5432,
    username: process.env.TYPEORM_USERNAME || 'postgres',
    password: process.env.TYPEORM_PASSWORD || '12345',
    database:
      process.env.TYPEORM_DATABASE ||
      (process.env.NODE_ENV === 'test' ? 'api_test' : 'api'),
    schema: 'public',
    extra: { max: 1 }, // Single connection for schema creation
  });

  await bootstrapDataSource.initialize();

  // Drop and create the worker schema
  await bootstrapDataSource.query(
    `DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`,
  );
  await bootstrapDataSource.query(`CREATE SCHEMA "${testSchema}"`);
  await bootstrapDataSource.destroy();

  // Create a DataSource configured for the worker schema with migrations
  // Use minimal pool size since we only need it for running migrations
  const workerDataSource = new DataSource({
    type: 'postgres',
    host: process.env.TYPEORM_HOST || 'localhost',
    port: 5432,
    username: process.env.TYPEORM_USERNAME || 'postgres',
    password: process.env.TYPEORM_PASSWORD || '12345',
    database:
      process.env.TYPEORM_DATABASE ||
      (process.env.NODE_ENV === 'test' ? 'api_test' : 'api'),
    schema: testSchema,
    extra: {
      max: 2, // Minimal pool for migrations to reduce memory usage
      // Set search_path: worker schema first (for table resolution), then public (for extensions like uuid-ossp)
      options: `-c search_path=${testSchema},public`,
    },
    entities: ['src/entity/**/*.{js,ts}'],
    migrations: ['src/migration/**/*.{js,ts}'],
    migrationsTableName: 'migrations',
    logging: false,
  });

  // Initialize the worker DataSource
  await workerDataSource.initialize();

  // Create a wrapped query runner for migrations
  const queryRunner = workerDataSource.createQueryRunner();
  await queryRunner.connect();

  // Wrap the query runner to transform schema references
  wrapQueryRunner(queryRunner, testSchema);

  try {
    // Create migrations table if it doesn't exist
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${testSchema}"."migrations" (
        "id" SERIAL PRIMARY KEY,
        "timestamp" bigint NOT NULL,
        "name" varchar NOT NULL
      )
    `);

    // Create typeorm_metadata table (used by TypeORM to track views, etc.)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${testSchema}"."typeorm_metadata" (
        "type" varchar NOT NULL,
        "database" varchar,
        "schema" varchar,
        "table" varchar,
        "name" varchar,
        "value" text
      )
    `);

    // Get all migration classes sorted by timestamp (from name)
    const allMigrations = [...workerDataSource.migrations].sort((a, b) => {
      // Extract timestamp from migration name (e.g., "SomeName1234567890123")
      // Some migrations don't have a name property, so use constructor name as fallback
      // Timestamps are 13 digits (Unix ms), extract last 13 digits to avoid issues
      // with names like "ProfileV21703668189004" where V2 could confuse extraction
      const getTimestamp = (migration: {
        name?: string;
        constructor: { name: string };
      }): number => {
        const name = migration.name || migration.constructor.name;
        // Match last 13 digits (Unix timestamp in milliseconds)
        const match = name.match(/(\d{13})$/);
        return match ? parseInt(match[1], 10) : 0;
      };
      return getTimestamp(a) - getTimestamp(b);
    });

    for (const migration of allMigrations) {
      // Get migration name (some migrations don't have a name property)
      const migrationName = migration.name || migration.constructor.name;

      // Check if migration was already run
      const alreadyRun = await queryRunner.query(
        `SELECT * FROM "${testSchema}"."migrations" WHERE "name" = $1`,
        [migrationName],
      );

      if (alreadyRun.length === 0) {
        // Run migration up
        await migration.up(queryRunner);

        // Extract timestamp from migration name (last 13 digits for Unix ms timestamp)
        const timestampMatch = migrationName.match(/(\d{13})$/);
        const timestamp = timestampMatch
          ? parseInt(timestampMatch[1], 10)
          : Date.now();

        // Record migration as run
        await queryRunner.query(
          `INSERT INTO "${testSchema}"."migrations" ("timestamp", "name") VALUES ($1, $2)`,
          [timestamp, migrationName],
        );
      }
    }
  } finally {
    await queryRunner.release();
  }

  await workerDataSource.destroy();
};

let schemaInitialized = false;

beforeAll(async () => {
  if (!schemaInitialized) {
    // Create worker schema for parallel test isolation
    // Public schema is set up by the pretest script
    if (testSchema !== 'public') {
      await createWorkerSchema();
    }
    schemaInitialized = true;
  }
}, 60000); // 60 second timeout for schema creation

beforeEach(async () => {
  loadAuthKeys();

  await cleanDatabase();
}, 30000); // 30 second timeout for database cleanup
