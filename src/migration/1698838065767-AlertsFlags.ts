import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertsFlags1698838065767 implements MigrationInterface {
  name = 'AlertsFlags1698838065767';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD "showGenericReferral" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD "flags" jsonb NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_alerts_flags_last_referral_reminder" ON alerts (((flags->'lastReferralReminder')::text))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_alerts_flags_last_referral_reminder"`,
    );
    await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "flags"`);
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP COLUMN "showGenericReferral"`,
    );
  }
}
