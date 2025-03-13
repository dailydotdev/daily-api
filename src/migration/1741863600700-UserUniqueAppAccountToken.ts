import { MigrationInterface, QueryRunner } from "typeorm";

export class UserUniqueAppAccountToken1741863600700 implements MigrationInterface {
  name = 'UserUniqueAppAccountToken1741863600700'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`CREATE UNIQUE INDEX IF NOT EXISTS IDX_user_app_account_token_unique
      ON "user" (("subscriptionFlags"->>'appAccountToken'));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`DROP INDEX IF EXISTS IDX_user_app_account_token_unique;`);
  }
}
