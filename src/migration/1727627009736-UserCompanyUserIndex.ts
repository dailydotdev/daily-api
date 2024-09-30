import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserCompanyUserIndex1727627009736 implements MigrationInterface {
  name = 'UserCompanyUserIndex1727627009736';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_user_company_user_id" ON "user_company" ("userId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_user_company_user_id"`);
  }
}
