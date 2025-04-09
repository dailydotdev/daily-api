import { MigrationInterface, QueryRunner } from 'typeorm';

export class CoresRoleDefaultNone1744110320719 implements MigrationInterface {
  name = 'CoresRoleDefaultNone1744110320719';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "coresRole" SET DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "coresRole" SET DEFAULT '3'`,
    );
  }
}
