import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserSubscriptionIndex1731913456006 implements MigrationInterface {
  name = 'UserSubscriptionIndex1731913456006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_user_subflags_subscriptionid" ON "public"."user" USING gin("subscriptionFlags")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_subflags_subscriptionid"`,
    );
  }
}
