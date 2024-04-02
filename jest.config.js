process.env.TZ = 'UTC';

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./__tests__/setup.ts'],
  globalTeardown: './__tests__/teardown.ts',
  testPathIgnorePatterns: [
    '<rootDir>/__tests__/setup.ts',
    '<rootDir>/__tests__/teardown.ts',
    '<rootDir>/__tests__/helpers.ts',
    '<rootDir>/__tests__/fixture/',
  ],
  snapshotFormat: {
    escapeString: true,
    printBasicPrototype: true,
  },
  workerIdleMemoryLimit: '2048MB',
};
