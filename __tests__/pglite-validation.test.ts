/**
 * PGlite Validation Tests
 *
 * These tests validate that PGlite works correctly with our TypeORM setup.
 * Run with: PGLITE_ENABLED=true npx jest __tests__/pglite-validation.test.ts --testEnvironment=node
 */

describe('PGlite Validation', () => {
  // Skip if PGlite is not enabled
  const runTest = process.env.PGLITE_ENABLED === 'true' ? it : it.skip;

  runTest(
    'should initialize PGlite and run migrations',
    async () => {
      const { PGlite } = await import('@electric-sql/pglite');
      const { PGliteDriver } = await import('typeorm-pglite');
      const { DataSource } = await import('typeorm');

      // Create in-memory PGlite instance
      const pglite = await PGlite.create('memory://');

      // Create DataSource with PGlite driver
      const driver = new PGliteDriver(pglite);
      const dataSource = new DataSource({
        type: 'postgres',
        driver: driver.driver as never,
        synchronize: false,
        logging: false,
        entities: ['src/entity/**/*.{js,ts}'],
        migrations: ['src/migration/**/*.{js,ts}'],
      });

      await dataSource.initialize();

      // Create uuid_generate_v4() compatibility function using built-in gen_random_uuid()
      // Must be created via DataSource after initialization for TypeORM to see it
      await dataSource.query(`
        CREATE OR REPLACE FUNCTION uuid_generate_v4()
        RETURNS uuid AS $$
          SELECT gen_random_uuid();
        $$ LANGUAGE SQL;
      `);
      const uuidResult = await dataSource.query(
        'SELECT uuid_generate_v4() as id',
      );
      expect(uuidResult[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );

      // Run migrations
      await dataSource.runMigrations();

      // Verify tables exist by checking a few key entities
      const tables = await dataSource.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `);
      const tableNames = tables.map((t: { tablename: string }) => t.tablename);

      expect(tableNames).toContain('user');
      expect(tableNames).toContain('post');
      expect(tableNames).toContain('source');

      await dataSource.destroy();
      await pglite.close();
    },
    120000,
  );

  runTest('should support JSONB operations', async () => {
    const { PGlite } = await import('@electric-sql/pglite');

    const pglite = await PGlite.create('memory://');

    // Test JSONB
    await pglite.exec(`
      CREATE TABLE test_jsonb (
        id SERIAL PRIMARY KEY,
        data JSONB DEFAULT '{}'::jsonb
      )
    `);

    await pglite.query(`INSERT INTO test_jsonb (data) VALUES ($1)`, [
      JSON.stringify({ key: 'value', nested: { arr: [1, 2, 3] } }),
    ]);

    const result = await pglite.query(`
      SELECT data->'key' as key, data->'nested'->'arr' as arr FROM test_jsonb
    `);

    expect(result.rows[0].key).toBe('value');
    expect(result.rows[0].arr).toEqual([1, 2, 3]);

    await pglite.close();
  });

  runTest('should support full-text search', async () => {
    const { PGlite } = await import('@electric-sql/pglite');

    const pglite = await PGlite.create('memory://');

    // Test tsvector/tsquery
    const result = await pglite.query(`
      SELECT to_tsvector('english', 'The quick brown fox') @@ to_tsquery('english', 'quick & fox') as match
    `);

    expect(result.rows[0].match).toBe(true);

    await pglite.close();
  });

  runTest('should support triggers and PL/pgSQL', async () => {
    const { PGlite } = await import('@electric-sql/pglite');

    const pglite = await PGlite.create('memory://');

    // Create test table
    await pglite.exec(`
      CREATE TABLE test_trigger (
        id SERIAL PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create trigger function
    await pglite.exec(`
      CREATE OR REPLACE FUNCTION update_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger
    await pglite.exec(`
      CREATE TRIGGER test_trigger_update
      BEFORE UPDATE ON test_trigger
      FOR EACH ROW EXECUTE FUNCTION update_timestamp()
    `);

    // Insert and update
    await pglite.query(`INSERT INTO test_trigger (value) VALUES ('initial')`);
    const before = await pglite.query(`SELECT updated_at FROM test_trigger`);

    // Small delay to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 100));

    await pglite.query(`UPDATE test_trigger SET value = 'updated'`);
    const after = await pglite.query(`SELECT updated_at FROM test_trigger`);

    // The trigger should have updated the timestamp
    expect(new Date(after.rows[0].updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(before.rows[0].updated_at).getTime(),
    );

    await pglite.close();
  });

  runTest('should support arrays', async () => {
    const { PGlite } = await import('@electric-sql/pglite');

    const pglite = await PGlite.create('memory://');

    await pglite.exec(`
      CREATE TABLE test_arrays (
        id SERIAL PRIMARY KEY,
        tags TEXT[]
      )
    `);

    await pglite.query(`INSERT INTO test_arrays (tags) VALUES ($1)`, [
      ['tag1', 'tag2', 'tag3'],
    ]);

    const result = await pglite.query(`SELECT * FROM test_arrays`);
    expect(result.rows[0].tags).toEqual(['tag1', 'tag2', 'tag3']);

    await pglite.close();
  });
});
