import { MigrationInterface, QueryRunner } from "typeorm";

export class DebeziumReplicationAdhoc1768995735317 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      DROP PUBLICATION IF EXISTS dbz_publication;
    `);
    await queryRunner.query(/* sql */`
      CREATE PUBLICATION dbz_publication
        FOR ALL TABLES
        WITH (publish_generated_columns = stored);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      DROP PUBLICATION IF EXISTS dbz_publication;
    `);
    await queryRunner.query(/* sql */`
      CREATE PUBLICATION dbz_publication
        FOR ALL TABLES;
    `);
  }
}
