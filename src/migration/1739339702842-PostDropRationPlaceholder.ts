import { MigrationInterface, QueryRunner } from "typeorm";

export class PostDropRationPlaceholder1739339702842 implements MigrationInterface {
  name = 'PostDropRationPlaceholder1739339702842'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "ratio"`);
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "placeholder"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" ADD "placeholder" text`);
    await queryRunner.query(`ALTER TABLE "post" ADD "ratio" double precision`);
  }
}
