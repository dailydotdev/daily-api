import { MigrationInterface, QueryRunner } from 'typeorm';

export class UnnecessarySettingsProperties1639656961912
  implements MigrationInterface
{
  name = 'UnnecessarySettingsProperties1639656961912';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."settings" DROP COLUMN "enableCardAnimations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."settings" DROP COLUMN "appInsaneMode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."settings" REPLICA IDENTITY FULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."settings" ADD "enableCardAnimations" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."settings" ADD "appInsaneMode" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."settings" REPLICA IDENTITY DEFAULT`,
    );
  }
}
