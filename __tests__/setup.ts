import * as matchers from 'jest-extended';
import '../src/config';
import createOrGetConnection from '../src/db';
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
        'forbidden.com',
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
      recruiterChannelInviteUsers: ['U013C30NE3V'],
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
    await repository.query(`DELETE
                            FROM "${entity.tableName}";`);

    for (const column of entity.primaryColumns) {
      if (column.generationStrategy === 'increment') {
        await repository.query(
          `ALTER SEQUENCE ${entity.tableName}_${column.databaseName}_seq RESTART WITH 1`,
        );
      }
    }
  }
};

export const fileTypeFromBuffer = jest.fn();
jest.mock('file-type', () => ({
  fileTypeFromBuffer: () => fileTypeFromBuffer(),
}));

beforeEach(async () => {
  loadAuthKeys();

  await cleanDatabase();
});
