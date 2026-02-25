import { MigrationInterface, QueryRunner } from 'typeorm';

export class DigestPost1772034691161 implements MigrationInterface {
  name = 'DigestPost1772034691161';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "public"."source" ("id", "name", "handle", "private", "image")
       VALUES ('digest', 'Daily digest', 'digest', false, 'https://media.daily.dev/image/upload/s--41O2Ks_6--/f_auto/v1751984990/public/Presidential%20briefing')
       ON CONFLICT DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "public"."source" WHERE "id" = 'digest'`,
    );
  }
}
