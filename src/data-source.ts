import 'reflect-metadata';
import { DataSource } from 'typeorm';

/**
 * Determine schema for test isolation.
 * Each Jest worker gets its own schema to enable parallel test execution.
 * Schema isolation is enabled in CI when ENABLE_SCHEMA_ISOLATION=true,
 * which allows parallel Jest workers to run without conflicts.
 */
const getSchema = (): string => {
  if (process.env.TYPEORM_SCHEMA) {
    return process.env.TYPEORM_SCHEMA;
  }
  // Enable schema isolation for parallel Jest workers in CI
  if (
    process.env.ENABLE_SCHEMA_ISOLATION === 'true' &&
    process.env.JEST_WORKER_ID
  ) {
    return `test_worker_${process.env.JEST_WORKER_ID}`;
  }
  return 'public';
};

export const testSchema = getSchema();

// PostgreSQL connection options to set search_path for raw SQL queries
const pgOptions =
  testSchema !== 'public' ? `-c search_path=${testSchema}` : undefined;

export const AppDataSource = new DataSource({
  type: 'postgres',
  schema: testSchema,
  synchronize: false,
  extra: {
    max: 30,
    idleTimeoutMillis: 0,
    // Set search_path at connection level so raw SQL uses the correct schema
    options: pgOptions,
  },
  logging: false,
  entities: ['src/entity/**/*.{js,ts}'],
  migrations: ['src/migration/**/*.{js,ts}'],
  subscribers: ['src/subscriber/**/*.{js,ts}'],
  replication: {
    defaultMode: 'master',
    master: {
      host: process.env.TYPEORM_HOST || 'localhost',
      port: 5432,
      username: process.env.TYPEORM_USERNAME || 'postgres',
      password: process.env.TYPEORM_PASSWORD || '12345',
      database:
        process.env.TYPEORM_DATABASE ||
        (process.env.NODE_ENV === 'test' ? 'api_test' : 'api'),
    },
    slaves: [
      {
        host:
          process.env.TYPEORM_READ_HOST ||
          process.env.TYPEORM_HOST ||
          'localhost',
        port: 5432,
        username: process.env.TYPEORM_READ_USERNAME || 'postgres',
        password:
          process.env.TYPEORM_READ_PASSWORD ||
          process.env.TYPEORM_PASSWORD ||
          '12345',
        database:
          process.env.TYPEORM_READ_DATABASE ||
          (process.env.NODE_ENV === 'test' ? 'api_test' : 'api'),
      },
    ],
  },
});
