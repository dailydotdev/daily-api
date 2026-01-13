import * as matchers from 'jest-extended';
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

beforeAll(async () => {
  // Schema creation is now handled by globalSetup.ts
  // This beforeAll just ensures the connection is ready
  await createOrGetConnection();
}, 30000);

beforeEach(async () => {
  loadAuthKeys();

  await cleanDatabase();
}, 60000);
