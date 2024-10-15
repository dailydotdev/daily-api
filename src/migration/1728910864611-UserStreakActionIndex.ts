import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserStreakActionIndex1728910864611 implements MigrationInterface {
  name = 'UserStreakActionIndex1728910864611';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_usa_userid_type" ON "user_streak_action" ("userId", "type") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_usa_userid_type"`);
  }
}
