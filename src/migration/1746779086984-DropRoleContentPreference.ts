import { MigrationInterface, QueryRunner } from "typeorm";

export class DropRoleContentPreference1746779086984 implements MigrationInterface {
  name = 'DropRoleContentPreference1746779086984'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "content_preference" DROP COLUMN "role"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "content_preference" ADD "role" text DEFAULT 'member'`);
  }
}
