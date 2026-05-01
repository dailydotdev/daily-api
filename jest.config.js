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
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./__tests__/setup.ts'],
  globalTeardown: './__tests__/teardown.ts',
  testPathIgnorePatterns: [
    '<rootDir>/__tests__/setup.ts',
    '<rootDir>/__tests__/teardown.ts',
    '<rootDir>/__tests__/.*/helpers.ts',
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
      '@swc/jest',
      {
        sourceMaps: true,
        jsc: {
          target: 'es2019',
          parser: {
            syntax: 'typescript',
            decorators: true,
          },
          transform: {
            legacyDecorator: true,
            decoratorMetadata: true,
          },
        },
        module: {
          type: 'commonjs',
          lazy: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^file-type$': '<rootDir>/node_modules/file-type/index.js',
    '^jose$': '<rootDir>/__mocks__/jose.ts',
    '^isomorphic-dompurify$': '<rootDir>/__mocks__/isomorphic-dompurify.ts',
    '^better-auth$': '<rootDir>/__mocks__/better-auth.ts',
    '^better-auth/api$': '<rootDir>/__mocks__/better-auth-api.ts',
    '^better-auth/node$': '<rootDir>/__mocks__/better-auth-node.ts',
    '^better-auth/plugins$': '<rootDir>/__mocks__/better-auth-plugins.ts',
    '^better-auth/plugins/email-otp$':
      '<rootDir>/__mocks__/better-auth-plugins-email-otp.ts',
  },
};
