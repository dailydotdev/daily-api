import * as matchers from 'jest-extended';
import { DataSource } from 'typeorm';
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

const cleanDatabase = async (): Promise<void> => {
  await remoteConfig.init();

  const con = await createOrGetConnection();
  for (const entity of con.entityMetadatas) {
    const repository = con.getRepository(entity.name);
    if (repository.metadata.tableType === 'view') continue;
    await repository.query(`DELETE FROM "${entity.tableName}";`);

    for (const column of entity.primaryColumns) {
      if (column.generationStrategy === 'increment') {
        // Use pg_get_serial_sequence to find the actual sequence name
        // This handles both original and copied tables with different sequence naming
        try {
          const seqResult = await repository.query(
            `SELECT pg_get_serial_sequence('"${entity.tableName}"', '${column.databaseName}') as seq_name`,
          );
          if (seqResult[0]?.seq_name) {
            await repository.query(
              `ALTER SEQUENCE ${seqResult[0].seq_name} RESTART WITH 1`,
            );
          }
        } catch {
          // Sequence might not exist, ignore
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
 * Create the worker schema for test isolation.
 * Creates a new schema and copies all table structures from public schema.
 * This is used when ENABLE_SCHEMA_ISOLATION=true for parallel Jest workers.
 */
const createWorkerSchema = async (): Promise<void> => {
  // Only create non-public schemas (when running with multiple Jest workers)
  if (testSchema === 'public') {
    return;
  }

  // Bootstrap connection using public schema
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
  });

  await bootstrapDataSource.initialize();

  // Drop and create the worker schema
  await bootstrapDataSource.query(
    `DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`,
  );
  await bootstrapDataSource.query(`CREATE SCHEMA "${testSchema}"`);

  // Get all tables from public schema (excluding views and TypeORM metadata)
  const tables = await bootstrapDataSource.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
    AND tablename != 'typeorm_metadata'
  `);

  // Copy table structure from public to worker schema
  for (const { tablename } of tables) {
    await bootstrapDataSource.query(`
      CREATE TABLE "${testSchema}"."${tablename}"
      (LIKE "public"."${tablename}" INCLUDING ALL)
    `);
  }

  // Copy migrations table so TypeORM knows migrations are already applied
  await bootstrapDataSource.query(`
    INSERT INTO "${testSchema}"."migrations" SELECT * FROM "public"."migrations"
  `);

  // Get all views from public schema and recreate them in worker schema
  const views = await bootstrapDataSource.query(`
    SELECT viewname, definition FROM pg_views
    WHERE schemaname = 'public'
  `);

  for (const { viewname, definition } of views) {
    // Replace public schema references with worker schema in view definition
    const modifiedDefinition = definition.replace(
      /public\./g,
      `${testSchema}.`,
    );
    await bootstrapDataSource.query(`
      CREATE OR REPLACE VIEW "${testSchema}"."${viewname}" AS ${modifiedDefinition}
    `);
  }

  // Get all materialized views from public schema and recreate them in worker schema
  const matViews = await bootstrapDataSource.query(`
    SELECT matviewname, definition FROM pg_matviews
    WHERE schemaname = 'public'
  `);

  for (const { matviewname, definition } of matViews) {
    // Replace public schema references with worker schema in view definition
    const modifiedDefinition = definition.replace(
      /public\./g,
      `${testSchema}.`,
    );
    await bootstrapDataSource.query(`
      CREATE MATERIALIZED VIEW "${testSchema}"."${matviewname}" AS ${modifiedDefinition}
    `);
  }

  // Copy all user-defined functions from public schema to worker schema
  // This includes both regular functions and trigger functions
  const allFunctions = await bootstrapDataSource.query(`
    SELECT p.proname as name, pg_get_functiondef(p.oid) as definition
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.prokind = 'f'
  `);

  for (const { definition } of allFunctions) {
    if (!definition) continue;
    // Replace public schema references with worker schema
    const modifiedDefinition = definition
      .replace(
        /CREATE (OR REPLACE )?FUNCTION public\./i,
        (_, orReplace) => `CREATE ${orReplace || ''}FUNCTION "${testSchema}".`,
      )
      .replace(/\bpublic\./gi, `"${testSchema}".`);
    try {
      await bootstrapDataSource.query(modifiedDefinition);
    } catch {
      // Some functions might fail due to dependencies, skip them
    }
  }

  // Copy triggers with schema references replaced
  const triggers = await bootstrapDataSource.query(`
    SELECT
      c.relname as table_name,
      t.tgname as trigger_name,
      pg_get_triggerdef(t.oid) as trigger_def
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
    AND NOT t.tgisinternal
  `);

  for (const { trigger_def } of triggers) {
    // Replace public schema references with worker schema
    // Also replace EXECUTE FUNCTION/PROCEDURE calls to use the worker schema
    const modifiedDef = trigger_def
      .replace(/\bpublic\./gi, `"${testSchema}".`)
      .replace(
        /EXECUTE (FUNCTION|PROCEDURE) (\w+)\(/gi,
        `EXECUTE $1 "${testSchema}".$2(`,
      );
    try {
      await bootstrapDataSource.query(modifiedDef);
    } catch {
      // Some triggers might fail due to missing functions, skip them
    }
  }

  await bootstrapDataSource.destroy();
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
});

beforeEach(async () => {
  loadAuthKeys();

  await cleanDatabase();
});
