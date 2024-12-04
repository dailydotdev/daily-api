import { MigrationInterface, QueryRunner } from "typeorm";

export class ContentPreferenceIndexes1732464610853 implements MigrationInterface {
  name = 'ContentPreferenceIndexes1732464610853'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_content_preference_source_id" ON "content_preference" ("sourceId") `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_content_preference_reference_user_id" ON "content_preference" ("referenceUserId") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_content_preference_reference_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_content_preference_source_id"`);
  }
}
