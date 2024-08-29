import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserCompanyFlags1724925076759 implements MigrationInterface {
  name = 'UserCompanyFlags1724925076759';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_company" ADD "flags" jsonb NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_company" DROP COLUMN "flags"`);
  }
}
