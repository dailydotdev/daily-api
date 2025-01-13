import { MigrationInterface, QueryRunner } from "typeorm";

export class PostTranslations1736519518183 implements MigrationInterface {
  name = 'PostTranslations1736519518183'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" ADD "translation" jsonb NOT NULL DEFAULT '{}'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "translation"`);
  }
}
