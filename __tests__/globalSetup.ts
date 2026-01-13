import { DataSource, QueryRunner } from 'typeorm';

/**
 * Replace hardcoded 'public.' schema references with the target schema.
 */
const replaceSchemaReferences = (sql: string, targetSchema: string): string => {
  if (targetSchema === 'public') return sql;

  let result = sql;

  // Handle DROP INDEX separately - remove schema qualification and add IF EXISTS
  result = result.replace(
    /DROP INDEX\s+(?:IF EXISTS\s+)?(?:"public"\.|public\.)?("[^"]+"|[\w]+)/gi,
    (_, indexName) => `DROP INDEX IF EXISTS ${indexName}`,
  );

  // Replace various patterns of public schema references
  result = result
    .replace(/\bpublic\."(\w+)"/gi, `"${targetSchema}"."$1"`)
    .replace(/\bpublic\.(\w+)(?=[\s,;())]|$)/gi, `"${targetSchema}"."$1"`)
    .replace(/"public"\."(\w+)"/gi, `"${targetSchema}"."$1"`)
    .replace(/\bON\s+public\./gi, `ON "${targetSchema}".`);

  return result;
};

/**
 * Wrap a QueryRunner to intercept and transform SQL queries.
 */
const wrapQueryRunner = (
  queryRunner: QueryRunner,
  targetSchema: string,
): QueryRunner => {
  const originalQuery = queryRunner.query.bind(queryRunner);

  queryRunner.query = async (
    query: string,
    parameters?: unknown[],
  ): Promise<unknown> => {
    const transformedQuery = replaceSchemaReferences(query, targetSchema);
    return originalQuery(transformedQuery, parameters);
  };

  return queryRunner;
};

/**
 * Create and run migrations for a single worker schema.
 */
const createWorkerSchema = async (schema: string): Promise<void> => {
  const workerDataSource = new DataSource({
    type: 'postgres',
    host: process.env.TYPEORM_HOST || 'localhost',
    port: 5432,
    username: process.env.TYPEORM_USERNAME || 'postgres',
    password: process.env.TYPEORM_PASSWORD || '12345',
    database:
      process.env.TYPEORM_DATABASE ||
      (process.env.NODE_ENV === 'test' ? 'api_test' : 'api'),
    schema,
    extra: {
      max: 2,
      options: `-c search_path=${schema},public`,
    },
    entities: ['src/entity/**/*.{js,ts}'],
    migrations: ['src/migration/**/*.{js,ts}'],
    migrationsTableName: 'migrations',
    logging: false,
  });

  await workerDataSource.initialize();

  const queryRunner = workerDataSource.createQueryRunner();
  await queryRunner.connect();
  wrapQueryRunner(queryRunner, schema);

  try {
    // Create migrations table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${schema}"."migrations" (
        "id" SERIAL PRIMARY KEY,
        "timestamp" bigint NOT NULL,
        "name" varchar NOT NULL
      )
    `);

    // Create typeorm_metadata table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${schema}"."typeorm_metadata" (
        "type" varchar NOT NULL,
        "database" varchar,
        "schema" varchar,
        "table" varchar,
        "name" varchar,
        "value" text
      )
    `);

    // Sort migrations by timestamp
    const allMigrations = [...workerDataSource.migrations].sort((a, b) => {
      const getTimestamp = (migration: {
        name?: string;
        constructor: { name: string };
      }): number => {
        const name = migration.name || migration.constructor.name;
        const match = name.match(/(\d{13})$/);
        return match ? parseInt(match[1], 10) : 0;
      };
      return getTimestamp(a) - getTimestamp(b);
    });

    for (const migration of allMigrations) {
      const migrationName = migration.name || migration.constructor.name;

      const alreadyRun = await queryRunner.query(
        `SELECT * FROM "${schema}"."migrations" WHERE "name" = $1`,
        [migrationName],
      );

      if (alreadyRun.length === 0) {
        await migration.up(queryRunner);

        const timestampMatch = migrationName.match(/(\d{13})$/);
        const timestamp = timestampMatch
          ? parseInt(timestampMatch[1], 10)
          : Date.now();

        await queryRunner.query(
          `INSERT INTO "${schema}"."migrations" ("timestamp", "name") VALUES ($1, $2)`,
          [timestamp, migrationName],
        );
      }
    }
  } finally {
    await queryRunner.release();
  }

  await workerDataSource.destroy();
};

/**
 * Jest global setup - runs once before all workers start.
 * Creates worker schemas for parallel test isolation.
 */
export default async function globalSetup(): Promise<void> {
  // Only run when schema isolation is enabled
  if (process.env.ENABLE_SCHEMA_ISOLATION !== 'true') {
    return;
  }

  const maxWorkers = parseInt(process.env.JEST_MAX_WORKERS || '4', 10);
  console.log(
    `\nCreating ${maxWorkers} worker schemas for parallel testing...`,
  );

  // First, create all schemas
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.TYPEORM_HOST || 'localhost',
    port: 5432,
    username: process.env.TYPEORM_USERNAME || 'postgres',
    password: process.env.TYPEORM_PASSWORD || '12345',
    database:
      process.env.TYPEORM_DATABASE ||
      (process.env.NODE_ENV === 'test' ? 'api_test' : 'api'),
    schema: 'public',
    extra: { max: 1 },
  });

  await dataSource.initialize();

  for (let i = 1; i <= maxWorkers; i++) {
    const schema = `test_worker_${i}`;
    await dataSource.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await dataSource.query(`CREATE SCHEMA "${schema}"`);
  }

  await dataSource.destroy();

  // Run migrations for each schema sequentially to avoid memory spikes
  for (let i = 1; i <= maxWorkers; i++) {
    const schema = `test_worker_${i}`;
    console.log(`Running migrations for ${schema}...`);
    await createWorkerSchema(schema);
  }

  console.log('All worker schemas ready!\n');
}
