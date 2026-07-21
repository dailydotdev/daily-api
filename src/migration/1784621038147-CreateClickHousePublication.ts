import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClickHousePublication1784621038147 implements MigrationInterface {
  name = 'CreateClickHousePublication1784621038147';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP PUBLICATION IF EXISTS "clickhouse_sync"
    `);

    await queryRunner.query(/* sql */ `
      CREATE PUBLICATION "clickhouse_sync"
        FOR ALL TABLES
        WITH (publish_generated_columns = stored)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */ `
      DROP PUBLICATION IF EXISTS "clickhouse_sync"
    `);
  }
}
