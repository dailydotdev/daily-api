import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChMigration1756375302904 implements MigrationInterface {
  name = 'ChMigration1756375302904';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "migrations_ch" ("id" bigint NOT NULL, "name" character varying NOT NULL, "timestamp" TIMESTAMP NOT NULL DEFAULT now(), "dirty" boolean NOT NULL, CONSTRAINT "PK_b0fa9708b4cd4f2ade3bf4d3e56" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "migrations_ch"`);
  }
}
