import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContentLanguage1724080448425 implements MigrationInterface {
  name = 'ContentLanguage1724080448425';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post" ADD "i18n" jsonb NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "language" text NOT NULL DEFAULT 'en'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "language"`);
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "i18n"`);
  }
}
