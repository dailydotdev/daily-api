import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertsFlags1698838065767 implements MigrationInterface {
  name = 'AlertsFlags1698838065767';

  public async up(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(`
        CREATE OR REPLACE FUNCTION dateCastIndex(jsonObject jsonb, field text)
        RETURNS date
        AS
        $$
          SELECT (jsonObject ->> field)::date;
        $$
        language sql
        IMMUTABLE;
      `);
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD "showGenericReferral" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD "flags" jsonb NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `CREATE INDEX on alerts ((dateCastIndex(flags, 'lastReferralReminder')));`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."alerts_datecastindex_idx"`);
    await queryRunner.query('DROP FUNCTION IF EXISTS dateCastIndex');
    await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "flags"`);
    await queryRunner.query(
      `ALTER TABLE "alerts" DROP COLUMN "showGenericReferral"`,
    );
  }
}
