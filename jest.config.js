process.env.TZ = 'UTC';

process.env.NODE_OPTIONS = [
  process.env.NODE_OPTIONS,
  // https://jestjs.io/docs/ecmascript-modules
  `--experimental-vm-modules`,
]
  .filter(Boolean)
  .join(' ');

/** @type {import('jest').Config} */
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
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // do not report type checking errors when running tests
        // those are visible on build and inside code editor
        diagnostics: {
          exclude: ['**'],
        },
      },
    ],
  },
  moduleNameMapper: {
    '^file-type$': '<rootDir>/node_modules/file-type/index.js',
    '^isomorphic-dompurify$': '<rootDir>/__mocks__/isomorphic-dompurify.ts',
  },
};
