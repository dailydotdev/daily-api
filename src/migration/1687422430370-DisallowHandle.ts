import { MigrationInterface, QueryRunner } from 'typeorm';

export class DisallowHandle1687422430370 implements MigrationInterface {
  name = 'DisallowHandle1687422430370';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "disallow_handle" ("value" character varying NOT NULL, CONSTRAINT "PK_8c84e48365905231826700dd8b4" PRIMARY KEY ("value"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "disallow_handle"`);
  }
}
