import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProfileV21703668189004 implements MigrationInterface {
  name = 'ProfileV21703668189004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "cover" text`);
    await queryRunner.query(`ALTER TABLE "user" ADD "readme" text`);
    await queryRunner.query(`ALTER TABLE "user" ADD "readmeHtml" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "readmeHtml"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "readme"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "cover"`);
  }
}
