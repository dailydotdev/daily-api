module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./__tests__/setup.ts'],
  testPathIgnorePatterns: [
    '<rootDir>/__tests__/setup.ts',
    // '<rootDir>/__tests__/fixture.ts',
    // '<rootDir>/__tests__/helpers.ts',
  ],
};
