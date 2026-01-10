/**
 * Hybrid PGlite/PostgreSQL test setup for Jest workers.
 *
 * This provides database isolation using PGlite for most tests,
 * with automatic fallback to real PostgreSQL for tests that require
 * features PGlite doesn't support (pg_trgm, materialized views, etc.).
 *
 * Usage:
 *   PGLITE_ENABLED=true pnpm test
 */
import * as matchers from 'jest-extended';
import { DataSource } from 'typeorm';
import '../src/config';
import { remoteConfig } from '../src/remoteConfig';
import { loadAuthKeys } from '../src/auth';

/**
 * Test files that require real PostgreSQL due to unsupported PGlite features.
 * These tests will use the real database connection instead of PGlite.
 *
 * Add test files here that use:
 * - pg_trgm extension (trigram search)
 * - Materialized views (REFRESH MATERIALIZED VIEW)
 * - Other PostgreSQL-specific features not supported by PGlite
 */
const TESTS_REQUIRING_REAL_PG = [
  // Tests using pg_trgm trigram search or materialized views
  'sources.ts', // Uses source_tag_view materialized view, similar sources search
  'users.ts', // Complex user search with trigram
  'bookmarks.ts', // Has search tests that use trigram search
  'posts.ts', // Complex triggers for poll voting, upvotes, etc.
  'search.ts', // Full-text search with trigram
  'feeds.ts', // Complex feed queries with search
  'comments.ts', // Complex triggers and relations
  // Add more test files as needed
];

/**
 * Check if the current test file requires real PostgreSQL.
 */
function requiresRealPostgres(): boolean {
  // Get the current test file from Jest's state
  const testPath = expect.getState().testPath;
  if (!testPath) return false;

  return TESTS_REQUIRING_REAL_PG.some((pattern) => testPath.includes(pattern));
}

// Track which mode we're using for the current test file
const dbState = {
  usingRealPostgres: false,
  realPgConnection: null as DataSource | null,
};

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

export const fileTypeFromBuffer = jest.fn();
jest.mock('file-type', () => ({
  fileTypeFromBuffer: () => fileTypeFromBuffer(),
}));

// Global PGlite DataSource for this worker
let pgliteDataSource: DataSource | null = null;

/**
 * SQL patterns that are incompatible with PGlite and should be skipped.
 */
const PGLITE_SKIP_PATTERNS = [
  // Skip extension commands - PGlite doesn't support most extensions
  /CREATE EXTENSION/i,
  /DROP EXTENSION/i,
  // Skip GIN/GIST indexes using trigram operators (handle multiline SQL)
  /CREATE INDEX[\s\S]*?USING\s+(?:gin|gist)\s*\([\s\S]*?gin_trgm_ops[\s\S]*?\)/i,
  // Also catch any query containing gin_trgm_ops as a simpler fallback
  /gin_trgm_ops/i,
];

/**
 * Known trigram indexes that we skip creating, so we should also skip dropping.
 */
const SKIPPED_TRIGRAM_INDEXES = [
  'IDX_tag_count_tag_search',
  'IDX_user_gin_username',
  'IDX_user_gin_name',
  'IDX_dataset_location_gin',
  'IDX_company_altName_trgm',
  'IDX_dataset_location_continent_trgm',
  'IDX_autocomplete_value_trgm',
  'IDX_company_name_trgm',
  'IDX_dataset_location_country_trgm',
  'IDX_dataset_location_city_trgm',
  'IDX_dataset_location_subdivision_trgm',
  'idx_keyword_value_trgm',
];

/**
 * Check if a SQL query should be skipped entirely.
 */
function shouldSkipQuery(query: string): boolean {
  // Skip if it matches skip patterns
  if (PGLITE_SKIP_PATTERNS.some((pattern) => pattern.test(query))) {
    return true;
  }

  // Skip DROP INDEX for trigram indexes we never created
  const dropIndexMatch = query.match(
    /DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?(?:"[^"]*"\.)?"([^"]+)"/i,
  );
  if (dropIndexMatch) {
    const indexName = dropIndexMatch[1];
    if (
      SKIPPED_TRIGRAM_INDEXES.some(
        (idx) => indexName.includes(idx) || idx.includes(indexName),
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Transform a query for PGlite compatibility.
 * Makes DROP statements use IF EXISTS to handle missing objects gracefully.
 */
function transformQuery(query: string): string {
  // Add IF EXISTS to DROP INDEX statements that don't have it
  if (/^DROP\s+INDEX\s+(?!IF\s+EXISTS)/i.test(query)) {
    return query.replace(/^DROP\s+INDEX\s+/i, 'DROP INDEX IF EXISTS ');
  }
  return query;
}

import { EventEmitter } from 'events';

/**
 * Split SQL into individual statements, respecting string literals and dollar-quoted strings.
 * PGlite doesn't support multi-statement queries in a single call.
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDollarQuote = false;
  let dollarTag = '';
  let i = 0;

  while (i < sql.length) {
    const char = sql[i];

    if (inDollarQuote) {
      current += char;
      // Check for end of dollar-quoted string
      if (char === '$') {
        const remaining = sql.slice(i);
        if (remaining.startsWith('$' + dollarTag + '$')) {
          current += dollarTag + '$';
          i += dollarTag.length + 1;
          inDollarQuote = false;
          dollarTag = '';
        }
      }
      i++;
      continue;
    }

    if (inSingleQuote) {
      current += char;
      if (char === "'") {
        // Check for escaped quote
        if (sql[i + 1] === "'") {
          current += "'";
          i += 2;
          continue;
        }
        inSingleQuote = false;
      }
      i++;
      continue;
    }

    // Check for dollar-quoted string start
    if (char === '$') {
      const match = sql.slice(i).match(/^\$([a-zA-Z0-9_]*)\$/);
      if (match) {
        dollarTag = match[1];
        current += match[0];
        i += match[0].length;
        inDollarQuote = true;
        continue;
      }
    }

    if (char === "'") {
      inSingleQuote = true;
      current += char;
      i++;
      continue;
    }

    if (char === ';') {
      statements.push(current.trim());
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
}

// Store the PGlite instance so we can clean up
let pgliteInstance: Awaited<
  ReturnType<typeof import('@electric-sql/pglite').PGlite.create>
> | null = null;

// Track skipped views/materialized views so we can skip indexes on them too
const skippedViews = new Set<string>();

/**
 * Known boolean columns across all entities.
 * TypeORM sends booleans as integers (1/0), but PGlite needs JavaScript booleans.
 * This comprehensive list was extracted from all entity files in src/entity/.
 */
const BOOLEAN_COLUMNS = new Set([
  // User & profile related
  'acceptedMarketing',
  'autoDismissNotifications',
  'awardEmail',
  'awardNotifications',
  'cioRegistered',
  'clickbaitShieldEnabled',
  'collapsePinnedPosts',
  'companionExpanded',
  'devcardEligible',
  'emailConfirmed',
  'feedbackDismiss',
  'followNotifications',
  'followingEmail',
  'hasSeenOpportunity',
  'hideExperience',
  'hideFeedPosts',
  'infoConfirmed',
  'insaneMode',
  'notificationEmail',
  'onboarding',
  'openNewTab',
  'optOutCompanion',
  'optOutReadingStreak',
  'optOutWeeklyGoal',
  'reminders',
  'showBorder',
  'showOnlyUnreadPosts',
  'showPlusGift',
  'showSlack',
  'showTopSites',
  'sidebarBookmarksExpanded',
  'sidebarCustomFeedsExpanded',
  'sidebarExpanded',
  'sidebarOtherExpanded',
  'sidebarResourcesExpanded',
  'sidebarSquadExpanded',
  'sortingEnabled',
  // Post entity
  'banned',
  'deleted',
  'private',
  'sentAnalyticsReport',
  'showOnFeed',
  'visible',
  'vordr',
  // Source entity
  'active',
  'featured',
  'moderationRequired',
  'public',
  'publicThreshold',
  // Alerts entity
  'bootPopup',
  'changelog',
  'companionHelper',
  'filter',
  'myFeed',
  'showGenericReferral',
  'showRecoverStreak',
  'showStreakMilestone',
  'showTopReader',
  'squadTour',
  // Other entities
  'approved',
  'banner',
  'blocked',
  'closed',
  'customKeywords',
  'defaultEnabledState',
  'dirty',
  'disableEngagementFilter',
  'emailSent',
  'enabled',
  'hidden',
  'isProfileCover',
  'rejected',
  'verified',
  // Common patterns
  'isDefault',
  'isActive',
  'isPublic',
  'isPrivate',
]);

/**
 * Get boolean column indices for an INSERT query.
 * Returns a map of parameter index to true if that param should be a boolean.
 */
function getBooleanParamIndices(query: string): Set<number> {
  const result = new Set<number>();

  // Extract column list from INSERT INTO "table"("col1", "col2", ...)
  const insertMatch = query.match(
    /INSERT\s+INTO\s+"?\w+"?\s*\(([^)]+)\)\s*VALUES/i,
  );
  if (!insertMatch) return result;

  const columnsStr = insertMatch[1];
  const columns = columnsStr.split(',').map((c) => c.trim().replace(/"/g, ''));

  // Find which column indices are boolean
  const booleanColumnIndices = new Set<number>();
  columns.forEach((col, idx) => {
    if (BOOLEAN_COLUMNS.has(col)) {
      booleanColumnIndices.add(idx);
    }
  });

  if (booleanColumnIndices.size === 0) return result;

  // Parse VALUES to map $N parameters to column positions
  // VALUES ($1, $2, DEFAULT, $3, ...), ($4, $5, DEFAULT, $6, ...)
  const valuesMatch = query.match(/VALUES\s*(.+?)(?:\s+RETURNING|\s*$)/is);
  if (!valuesMatch) return result;

  const valuesStr = valuesMatch[1];
  let position = 0; // Column position within current row
  let inParens = 0;

  // Parse through VALUES to find which $N params are at boolean positions
  const paramRegex = /\$(\d+)/g;
  let match;

  // Track column position as we scan through
  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];

    if (char === '(') {
      inParens++;
      if (inParens === 1) position = 0;
    } else if (char === ')') {
      inParens--;
    } else if (char === ',' && inParens === 1) {
      position++;
    } else if (char === '$' && inParens === 1) {
      // Found a parameter
      let numStr = '';
      let j = i + 1;
      while (j < valuesStr.length && /\d/.test(valuesStr[j])) {
        numStr += valuesStr[j];
        j++;
      }
      if (numStr) {
        const paramIdx = parseInt(numStr, 10) - 1; // Convert to 0-based
        if (booleanColumnIndices.has(position)) {
          result.add(paramIdx);
        }
      }
      i = j - 1;
    }
  }

  return result;
}

/**
 * Transform parameters for INSERT query - convert integers to booleans for boolean columns.
 */
function transformInsertParams(
  query: string,
  params: unknown[] | undefined,
): unknown[] | undefined {
  if (!params || params.length === 0) return params;

  const booleanParamIndices = getBooleanParamIndices(query);
  if (booleanParamIndices.size === 0) return params;

  return params.map((p, idx) => {
    if (booleanParamIndices.has(idx)) {
      // Convert to boolean
      if (p === 1 || p === '1' || p === 't' || p === 'true') return true;
      if (p === 0 || p === '0' || p === 'f' || p === 'false') return false;
      if (typeof p === 'boolean') return p;
    }
    return p;
  });
}

/**
 * Get boolean parameter indices for an UPDATE query.
 * Handles: UPDATE "table" SET "col1" = $1, "col2" = $2 WHERE ...
 */
function getBooleanUpdateParamIndices(query: string): Set<number> {
  const result = new Set<number>();

  // Match SET clause: SET "col1" = $1, "col2" = $2, ...
  const setMatch = query.match(/SET\s+([\s\S]+?)(?:\s+WHERE|\s*$)/i);
  if (!setMatch) return result;

  const setClause = setMatch[1];

  // Find all column = $N patterns in the SET clause
  const assignmentRegex = /"?(\w+)"?\s*=\s*\$(\d+)/g;
  let match;

  while ((match = assignmentRegex.exec(setClause)) !== null) {
    const columnName = match[1];
    const paramNum = parseInt(match[2], 10) - 1; // Convert to 0-based

    if (BOOLEAN_COLUMNS.has(columnName)) {
      result.add(paramNum);
    }
  }

  return result;
}

/**
 * Transform parameters for UPDATE query - convert integers to booleans for boolean columns.
 */
function transformUpdateParams(
  query: string,
  params: unknown[] | undefined,
): unknown[] | undefined {
  if (!params || params.length === 0) return params;

  const booleanParamIndices = getBooleanUpdateParamIndices(query);
  if (booleanParamIndices.size === 0) return params;

  return params.map((p, idx) => {
    if (booleanParamIndices.has(idx)) {
      // Convert to boolean
      if (p === 1 || p === '1' || p === 't' || p === 'true') return true;
      if (p === 0 || p === '0' || p === 'f' || p === 'false') return false;
      if (typeof p === 'boolean') return p;
    }
    return p;
  });
}

/**
 * Custom pool class for PGlite that bypasses the singleton in typeorm-pglite.
 * This is necessary because typeorm-pglite always uses a singleton pattern.
 * The pool extends EventEmitter as required by TypeORM's PostgresDriver.
 */
function createCustomPool(instance: typeof pgliteInstance) {
  return class CustomPGlitePool extends EventEmitter {
    constructor() {
      super();
    }

    doneCallback() {}

    async connect(
      callback: (
        err: Error | null,
        client: this | null,
        done: () => void,
      ) => void,
    ) {
      try {
        callback(null, this, this.doneCallback);
      } catch (error) {
        callback(error as Error, null, this.doneCallback);
      }
    }

    async query(
      sqlQuery: string,
      queryParameters?:
        | unknown[]
        | ((err: Error | null, result: unknown) => void),
      callback?: (err: Error | null, result: unknown) => void,
    ) {
      let cb = callback;
      let params = queryParameters as unknown[] | undefined;
      if (typeof queryParameters === 'function') {
        cb = queryParameters;
        params = undefined;
      }

      // Transform queries for PGlite compatibility
      let query = sqlQuery;

      // Add IF NOT EXISTS to CREATE INDEX to handle STI duplicate index issue
      if (/^CREATE\s+(UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS)/i.test(query)) {
        query = query.replace(
          /^CREATE\s+(UNIQUE\s+)?INDEX\s+/i,
          'CREATE $1INDEX IF NOT EXISTS ',
        );
      }

      // Transform "type array" to "type[]" syntax (PGlite prefers standard syntax)
      query = query.replace(
        /\b(text|integer|varchar|boolean|smallint|bigint|numeric|real|double precision|uuid|timestamp|date|time|json|jsonb)\s+array\b/gi,
        '$1[]',
      );

      // Skip queries that are incompatible with PGlite
      if (shouldSkipQuery(query)) {
        const result = { rows: [], rowCount: 0 };
        if (cb) cb(null, result);
        return Promise.resolve(result);
      }

      // Skip ALL materialized views - they have complex dependencies and often
      // reference other views or contain TypeORM parameters that aren't resolved
      const matViewMatch = query.match(
        /CREATE\s+MATERIALIZED\s+VIEW\s+"?(\w+)"?/i,
      );
      if (matViewMatch) {
        skippedViews.add(matViewMatch[1].toLowerCase());
        const result = { rows: [], rowCount: 0 };
        if (cb) cb(null, result);
        return Promise.resolve(result);
      }

      // Skip regular views with unresolved TypeORM parameters
      const viewParamMatch = query.match(/CREATE\s+VIEW\s+"?(\w+)"?/i);
      if (viewParamMatch && /:\w+/.test(query)) {
        skippedViews.add(viewParamMatch[1].toLowerCase());
        const result = { rows: [], rowCount: 0 };
        if (cb) cb(null, result);
        return Promise.resolve(result);
      }

      // Skip index creation on views that we've skipped
      const indexOnMatch = query.match(
        /CREATE\s+(?:UNIQUE\s+)?INDEX.*?\s+ON\s+"?(\w+)"?/i,
      );
      if (indexOnMatch && skippedViews.has(indexOnMatch[1].toLowerCase())) {
        const result = { rows: [], rowCount: 0 };
        if (cb) cb(null, result);
        return Promise.resolve(result);
      }

      // Transform INSERT parameters - convert integers to booleans for boolean columns
      // PGlite accepts JavaScript booleans but not integer 1/0 for boolean columns
      if (/^INSERT\s+INTO/i.test(query)) {
        params = transformInsertParams(query, params);
      }

      // Transform UPDATE parameters - convert integers to booleans for boolean columns
      if (/^UPDATE\s+/i.test(query)) {
        params = transformUpdateParams(query, params);
      }

      // PGlite doesn't support multi-statement queries
      // Split on semicolons but be careful about statements inside strings
      const statements = splitStatements(query);

      try {
        let lastResult: { rows: unknown[]; rowCount?: number } | undefined;
        for (const stmt of statements) {
          const trimmed = stmt.trim();
          if (!trimmed) continue;
          try {
            lastResult = await instance!.query(trimmed, params);
          } catch (stmtError) {
            throw stmtError;
          }
          // Only use params for the first statement
          params = undefined;
        }
        const results = lastResult || { rows: [] };
        if (cb) {
          cb(null, results);
        }
        return results;
      } catch (error) {
        if (cb) {
          cb(error as Error, null);
        }
        throw error;
      }
    }

    end(errorCallback: (err: Error | null) => void) {
      if (instance) {
        instance
          .close()
          .then(() => {
            pgliteInstance = null;
            errorCallback(null);
          })
          .catch((error) => errorCallback(error));
      } else {
        errorCallback(null);
      }
    }
  };
}

/**
 * Initialize PGlite database with schema sync instead of migrations.
 * This is simpler and avoids migration compatibility issues with PGlite.
 */
async function initializePgliteDatabase(): Promise<DataSource> {
  try {
    // Dynamic import PGlite directly
    const { PGlite } = await import('@electric-sql/pglite');

    // Close existing instance if any
    if (pgliteInstance) {
      await pgliteInstance.close();
      pgliteInstance = null;
    }

    // Clear tracked skipped views for fresh start
    skippedViews.clear();

    // Create a fresh in-memory PGlite instance
    pgliteInstance = await PGlite.create('memory://');

    // Create uuid_generate_v4() compatibility function using built-in gen_random_uuid()
    // This must be done before TypeORM schema synchronization
    await pgliteInstance.query(`
      CREATE OR REPLACE FUNCTION uuid_generate_v4()
      RETURNS uuid AS $$
        SELECT gen_random_uuid();
      $$ LANGUAGE SQL;
    `);

    // Create slugify function used by autocomplete table's generated column
    await pgliteInstance.query(`
      CREATE OR REPLACE FUNCTION slugify(text)
      RETURNS text AS $$
        SELECT trim(BOTH '-' FROM regexp_replace(lower(trim(COALESCE(LEFT($1,100),''))), '[^a-z0-9-]+', '-', 'gi'))
      $$ LANGUAGE SQL IMMUTABLE;
    `);

    // Create a custom driver that uses our direct PGlite instance
    const CustomPool = createCustomPool(pgliteInstance);

    pgliteDataSource = new DataSource({
      type: 'postgres',
      driver: { Pool: CustomPool } as never,
      // Drop and recreate schema to ensure clean state
      dropSchema: true,
      // Use synchronize to create schema from entities instead of running migrations
      // This avoids compatibility issues with extensions like pg_trgm
      synchronize: true,
      logging: false,
      entities: ['src/entity/**/*.{js,ts}'],
      subscribers: ['src/subscriber/**/*.{js,ts}'],
    });

    await pgliteDataSource.initialize();

    return pgliteDataSource;
  } catch (error) {
    console.error('PGlite initialization failed:', error);
    throw error;
  }
}

/**
 * Clean all data from PGlite database between tests.
 */
async function cleanPgliteDatabase(con: DataSource): Promise<void> {
  for (const entity of con.entityMetadatas) {
    const repository = con.getRepository(entity.name);
    if (repository.metadata.tableType === 'view') continue;

    // Skip migrations table
    if (entity.tableName === 'migrations') continue;

    try {
      await repository.query(`DELETE FROM "${entity.tableName}"`);

      // Reset auto-increment columns
      for (const column of entity.primaryColumns) {
        if (column.generationStrategy === 'increment') {
          try {
            const seqResult = await repository.query(
              `SELECT pg_get_serial_sequence($1, $2) as seq_name`,
              [entity.tableName, column.databaseName],
            );
            if (seqResult[0]?.seq_name) {
              await repository.query(
                `ALTER SEQUENCE ${seqResult[0].seq_name} RESTART WITH 1`,
              );
            }
          } catch {
            // Ignore sequence reset failures
          }
        }
      }
    } catch {
      // Ignore cleanup errors for individual tables
    }
  }
}

// Import the real db module for fallback
const realCreateOrGetConnection = jest.requireActual('../src/db')
  .default as () => Promise<DataSource>;

// Override createOrGetConnection - returns PGlite or real PG based on mode
jest.mock('../src/db', () => ({
  __esModule: true,
  default: async () => {
    // Return real PG connection if we're in that mode
    if (dbState.usingRealPostgres) {
      if (!dbState.realPgConnection) {
        // Lazy initialization of real PG connection
        dbState.realPgConnection = await realCreateOrGetConnection();
      }
      return dbState.realPgConnection;
    }

    // Otherwise return PGlite
    if (!pgliteDataSource) {
      throw new Error('PGlite DataSource not initialized');
    }
    return pgliteDataSource;
  },
}));

/**
 * Clean real PostgreSQL database between tests.
 * Same logic as original setup.ts
 */
async function cleanRealDatabase(con: DataSource): Promise<void> {
  for (const entity of con.entityMetadatas) {
    const repository = con.getRepository(entity.name);
    if (repository.metadata.tableType === 'view') continue;
    await repository.query(`DELETE FROM "${entity.tableName}";`);

    for (const column of entity.primaryColumns) {
      if (column.generationStrategy === 'increment') {
        await repository.query(
          `ALTER SEQUENCE ${entity.tableName}_${column.databaseName}_seq RESTART WITH 1`,
        );
      }
    }
  }
}

const initialized = { pglite: false, realPg: false };

beforeAll(async () => {
  // Determine mode based on test file path
  const testPath = expect.getState().testPath || '';
  dbState.usingRealPostgres = TESTS_REQUIRING_REAL_PG.some((pattern) =>
    testPath.includes(pattern),
  );

  if (dbState.usingRealPostgres) {
    // Use real PostgreSQL for this test file
    if (!initialized.realPg) {
      dbState.realPgConnection = await realCreateOrGetConnection();
      initialized.realPg = true;
    }
  } else {
    // Use PGlite for this test file
    if (!initialized.pglite) {
      pgliteDataSource = await initializePgliteDatabase();
      initialized.pglite = true;
    }
  }
}, 120000); // 2 minute timeout for initial setup

beforeEach(async () => {
  loadAuthKeys();
  await remoteConfig.init();

  if (dbState.usingRealPostgres && dbState.realPgConnection) {
    await cleanRealDatabase(dbState.realPgConnection);
  } else if (pgliteDataSource) {
    await cleanPgliteDatabase(pgliteDataSource);
  }
});

afterAll(async () => {
  // Only clean up PGlite - real PG connection is managed elsewhere
  if (!dbState.usingRealPostgres && pgliteDataSource?.isInitialized) {
    await pgliteDataSource.destroy();
    pgliteDataSource = null;
  }
});
