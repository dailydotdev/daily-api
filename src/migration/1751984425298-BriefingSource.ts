import { MigrationInterface, QueryRunner } from 'typeorm';

export class BriefingSource1751984425298 implements MigrationInterface {
  name = 'BriefingSource1751984425298';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "public"."source" ("id", "name", "handle", "private") VALUES ('briefing', 'Presidential briefing', 'briefing', 'false') ON CONFLICT DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "public"."source" WHERE "id" = 'briefing'`,
    );
  }
}
