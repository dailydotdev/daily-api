import { MigrationInterface, QueryRunner } from "typeorm";

export class UserSubscriptionProvider1740042768350 implements MigrationInterface {
  name = 'UserSubscriptionProvider1740042768350'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "user"
      SET "subscriptionFlags" = jsonb_set("subscriptionFlags", '{provider}', '"paddle"')
      WHERE "subscriptionFlags" <> '{}'::jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "user"
      SET "subscriptionFlags" = "subscriptionFlags" - 'provider'
      WHERE "subscriptionFlags" ? 'provider';
    `);
  }
}
