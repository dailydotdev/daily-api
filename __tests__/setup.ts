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

  // Get all table names to truncate (excluding views and seed data tables)
  const tablesToTruncate = con.entityMetadatas
    .filter(
      (entity) =>
        entity.tableType !== 'view' && !SEED_DATA_TABLES.has(entity.tableName),
    )
    .map((entity) => `"${testSchema}"."${entity.tableName}"`);

  if (tablesToTruncate.length > 0) {
    // Single TRUNCATE with CASCADE handles FK dependencies and RESTART IDENTITY resets sequences
    await con.query(
      `TRUNCATE ${tablesToTruncate.join(', ')} RESTART IDENTITY CASCADE`,
    );
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
}, 30000); // 30 second timeout for database cleanup
