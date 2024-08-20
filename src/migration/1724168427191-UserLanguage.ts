import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserLanguage1724168427191 implements MigrationInterface {
  name = 'UserLanguage1724168427191';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "language" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "language"`);
  }
}
