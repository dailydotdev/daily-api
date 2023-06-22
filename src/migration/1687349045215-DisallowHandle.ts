import { MigrationInterface, QueryRunner } from 'typeorm';

export class DisallowHandle1687349045215 implements MigrationInterface {
  name = 'DisallowHandle1687349045215';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "disallow_handle" ("value" character varying NOT NULL, CONSTRAINT "PK_8c84e48365905231826700dd8b4" PRIMARY KEY ("value"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_8c84e48365905231826700dd8b" ON "disallow_handle" ("value") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8c84e48365905231826700dd8b"`,
    );
    await queryRunner.query(`DROP TABLE "disallow_handle"`);
  }
}
