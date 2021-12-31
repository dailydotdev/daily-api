import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertsMyFeedColumn1640931306714 implements MigrationInterface {
  name = 'AlertsMyFeedColumn1640931306714';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."alerts" ADD "myFeed" text NULL DEFAULT 'default'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."alerts" DROP COLUMN "myFeed"`,
    );
  }
}
