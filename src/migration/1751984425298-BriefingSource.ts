import { MigrationInterface, QueryRunner } from 'typeorm';

export class BriefingSource1751984425298 implements MigrationInterface {
  name = 'BriefingSource1751984425298';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "public"."source" ("id", "name", "handle", "private", "image") VALUES ('briefing', 'Presidential briefing', 'briefing', 'false', 'https://media.daily.dev/image/upload/s--41O2Ks_6--/f_auto/v1751984990/public/Presidential%20briefing') ON CONFLICT DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "public"."source" WHERE "id" = 'briefing'`,
    );
  }
}
