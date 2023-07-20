import { MigrationInterface, QueryRunner } from 'typeorm';

export class PublicSourceData1689858892658 implements MigrationInterface {
  name = 'PublicSourceData1689858892658';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "source" ADD "headerImage" text`);
    await queryRunner.query(`ALTER TABLE "source" ADD "color" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "color"`);
    await queryRunner.query(`ALTER TABLE "source" DROP COLUMN "headerImage"`);
  }
}
