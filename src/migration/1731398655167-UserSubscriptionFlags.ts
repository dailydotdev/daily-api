import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserSubscriptionFlags1731398655167 implements MigrationInterface {
  name = 'UserSubscriptionFlags1731398655167';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "subscriptionFlags" jsonb NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "subscriptionFlags"`,
    );
  }
}
