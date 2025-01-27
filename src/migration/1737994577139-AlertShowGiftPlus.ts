import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertShowGiftPlus1737994577139 implements MigrationInterface {
  name = 'AlertShowGiftPlus1737994577139';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "alerts" ADD "showPlusGift" boolean NOT NULL DEFAULT false`,
    );
    queryRunner.query(`
        CREATE OR REPLACE FUNCTION show_gifted_plus()
          RETURNS TRIGGER
          LANGUAGE PLPGSQL
          AS
        $$
        BEGIN
          UPDATE  alerts
          SET     "showPlusGift" = true
          WHERE   id = NEW.id;
          RETURN NEW;
        END;
        $$
      `);
    queryRunner.query(
      `
        CREATE TRIGGER show_gifted_plus
        AFTER UPDATE ON "user"
        FOR EACH ROW
        WHEN (
          (NEW."subscriptionFlags"->>'gifterId' <> '') IS NOT TRUE AND
          NEW."subscriptionFlags"->>'gifterId' IS NOT NULL AND
          NEW."subscriptionFlags"->>'gifterId' <> OLD."subscriptionFlags"->>'gifterId'
        )
        EXECUTE PROCEDURE show_gifted_plus()
      `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query('DROP TRIGGER IF EXISTS show_gifted_plus ON post');
    queryRunner.query('DROP FUNCTION IF EXISTS show_gifted_plus');
    await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "showPlusGift"`);
  }
}
