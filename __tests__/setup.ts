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

  // Fix sequences: CREATE TABLE ... LIKE ... copies defaults that reference
  // the original public schema sequences. We need to create new sequences
  // in the worker schema and update column defaults to use them.
  const columnsWithSequences = await bootstrapDataSource.query(`
    SELECT
      c.table_name,
      c.column_name,
      c.column_default
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
    AND c.column_default LIKE 'nextval(%'
  `);

  for (const col of columnsWithSequences) {
    // Extract sequence name from default like: nextval('advanced_settings_id_seq'::regclass)
    const match = col.column_default.match(/nextval\('([^']+)'::regclass\)/);
    if (!match) continue;

    // Create sequence name for worker schema - use table_column_seq naming
    const newSeqName = `${col.table_name}_${col.column_name}_seq`;

    try {
      // Create new sequence in worker schema
      await bootstrapDataSource.query(`
        CREATE SEQUENCE IF NOT EXISTS "${testSchema}"."${newSeqName}"
      `);

      // Update column default to use the new sequence
      await bootstrapDataSource.query(`
        ALTER TABLE "${testSchema}"."${col.table_name}"
        ALTER COLUMN "${col.column_name}"
        SET DEFAULT nextval('"${testSchema}"."${newSeqName}"')
      `);

      // Mark the sequence as owned by the column (for proper cleanup)
      await bootstrapDataSource.query(`
        ALTER SEQUENCE "${testSchema}"."${newSeqName}"
        OWNED BY "${testSchema}"."${col.table_name}"."${col.column_name}"
      `);
    } catch {
      // Sequence creation might fail, skip
    }
  }

  // Copy foreign key constraints from public to worker schema
  // INCLUDING ALL does not copy FK constraints because they reference other tables
  const fkConstraints = await bootstrapDataSource.query(`
    SELECT
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule,
      rc.update_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
  `);

  for (const fk of fkConstraints) {
    const deleteAction =
      fk.delete_rule === 'NO ACTION' ? '' : `ON DELETE ${fk.delete_rule}`;
    const updateAction =
      fk.update_rule === 'NO ACTION' ? '' : `ON UPDATE ${fk.update_rule}`;
    try {
      await bootstrapDataSource.query(`
        ALTER TABLE "${testSchema}"."${fk.table_name}"
        ADD CONSTRAINT "${fk.constraint_name}"
        FOREIGN KEY ("${fk.column_name}")
        REFERENCES "${testSchema}"."${fk.foreign_table_name}"("${fk.foreign_column_name}")
        ${deleteAction} ${updateAction}
      `);
    } catch {
      // Some FK constraints might fail due to missing tables or order, skip
    }
  }

  // Copy migrations table so TypeORM knows migrations are already applied
  await bootstrapDataSource.query(`
    INSERT INTO "${testSchema}"."migrations" SELECT * FROM "public"."migrations"
  `);

  // Copy specific seed data records that migrations created
  // These are ONLY system records that tests expect to exist AND don't recreate themselves
  // NOTE: Do NOT copy data for tables where tests create their own data with explicit IDs
  // (advanced_settings, source_category, prompt) - tests expect these tables to start empty
  const seedQueries = [
    // Ghost and system users (protected by prevent_special_user_delete trigger)
    `INSERT INTO "${testSchema}"."user" SELECT * FROM "public"."user" WHERE id IN ('404', 'system')`,
    // System sources
    `INSERT INTO "${testSchema}"."source" SELECT * FROM "public"."source" WHERE id IN ('community', 'unknown', 'briefing', 'squads')`,
    // Checkpoints (all are seed data, tests don't create their own)
    `INSERT INTO "${testSchema}"."checkpoint" SELECT * FROM "public"."checkpoint"`,
    // Ghost post placeholder
    `INSERT INTO "${testSchema}"."post" SELECT * FROM "public"."post" WHERE id = '404'`,
  ];

  for (const query of seedQueries) {
    try {
      await bootstrapDataSource.query(query);
    } catch {
      // Record might not exist or FK constraints, skip
    }
  }

  // Get all table and materialized view names from public schema for view definition replacement
  // pg_matviews.definition retains internal OID references even though it shows unqualified names,
  // so we must explicitly qualify ALL table/view references in the definition text
  const publicObjects = await bootstrapDataSource.query(`
    SELECT tablename as name FROM pg_tables WHERE schemaname = 'public'
    UNION
    SELECT matviewname as name FROM pg_matviews WHERE schemaname = 'public'
  `);
  const objectNames = new Set(publicObjects.map((r: { name: string }) => r.name));

  // Function to replace unqualified table/view references with schema-qualified ones
  const qualifyTableRefs = (sql: string): string => {
    let result = sql;
    for (const name of objectNames) {
      // Replace FROM tablename, JOIN tablename patterns with schema-qualified versions
      // Also handle PostgreSQL's (tablename alias format in complex queries
      // Patterns to match:
      // - FROM tablename (with optional whitespace)
      // - JOIN tablename (with optional whitespace)
      // - FROM (tablename alias - PostgreSQL's format for JOINs in parentheses
      // - JOIN (tablename alias
      const patterns = [
        new RegExp(`(FROM\\s+)(${name})(\\s|$|,)`, 'gi'),
        new RegExp(`(JOIN\\s+)(${name})(\\s|$|,)`, 'gi'),
        new RegExp(`(FROM\\s*\\()(${name})(\\s)`, 'gi'),
        new RegExp(`(JOIN\\s*\\()(${name})(\\s)`, 'gi'),
      ];
      for (const pattern of patterns) {
        result = result.replace(pattern, `$1"${testSchema}"."${name}"$3`);
      }
    }
    return result;
  };

  // Get all views from public schema and recreate them in worker schema
  const views = await bootstrapDataSource.query(`
    SELECT viewname, definition FROM pg_views
    WHERE schemaname = 'public'
  `);

  for (const { viewname, definition } of views) {
    const qualifiedDef = qualifyTableRefs(definition);
    await bootstrapDataSource.query(`
      CREATE OR REPLACE VIEW "${testSchema}"."${viewname}" AS ${qualifiedDef}
    `);
  }

  // Get all materialized views from public schema and recreate them in worker schema
  // Order matters: some views depend on others (e.g., trending_tag depends on trending_post)
  const matViews = await bootstrapDataSource.query(`
    SELECT matviewname, definition FROM pg_matviews
    WHERE schemaname = 'public'
  `);

  for (const { matviewname, definition } of matViews) {
    const qualifiedDef = qualifyTableRefs(definition);
    try {
      await bootstrapDataSource.query(`
        CREATE MATERIALIZED VIEW "${testSchema}"."${matviewname}" AS ${qualifiedDef}
      `);
    } catch {
      // Some views depend on others - will retry in second pass
    }
  }

  // Second pass for views that depend on other views
  for (const { matviewname, definition } of matViews) {
    try {
      // Check if view exists, if not create it
      const exists = await bootstrapDataSource.query(`
        SELECT 1 FROM pg_matviews
        WHERE schemaname = $1 AND matviewname = $2
      `, [testSchema, matviewname]);
      if (exists.length === 0) {
        const qualifiedDef = qualifyTableRefs(definition);
        await bootstrapDataSource.query(`
          CREATE MATERIALIZED VIEW "${testSchema}"."${matviewname}" AS ${qualifiedDef}
        `);
      }
    } catch {
      // Skip if still fails
    }
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
    let modifiedDefinition = definition
      .replace(
        /CREATE (OR REPLACE )?FUNCTION public\./i,
        (_, orReplace) => `CREATE ${orReplace || ''}FUNCTION "${testSchema}".`,
      )
      .replace(/\bpublic\./gi, `"${testSchema}".`);

    // Add SET search_path clause after LANGUAGE clause so unqualified table names resolve correctly
    // This handles trigger functions that reference tables without schema prefix
    if (
      !modifiedDefinition.includes('SET search_path') &&
      modifiedDefinition.includes('LANGUAGE plpgsql')
    ) {
      modifiedDefinition = modifiedDefinition.replace(
        /LANGUAGE plpgsql/i,
        `LANGUAGE plpgsql SET search_path = '${testSchema}'`,
      );
    }

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
}, 60000); // 60 second timeout for schema creation

beforeEach(async () => {
  loadAuthKeys();

  await cleanDatabase();
});
