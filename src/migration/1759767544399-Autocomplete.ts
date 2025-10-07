import { MigrationInterface, QueryRunner } from 'typeorm';

export class Autocomplete1759767544399 implements MigrationInterface {
  name = 'Autocomplete1759767544399';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "autocomplete" ("value" text NOT NULL, "type" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "enabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_autocomplete_value_type" PRIMARY KEY ("value", "type"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "autocomplete"`);
  }
}
