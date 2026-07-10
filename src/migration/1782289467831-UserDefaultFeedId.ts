import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserDefaultFeedId1782289467831 implements MigrationInterface {
  name = 'UserDefaultFeedId1782289467831';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_defaultFeedId" ON "user" ("defaultFeedId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_defaultFeedId"`);
  }
}
