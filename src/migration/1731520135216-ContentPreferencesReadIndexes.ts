import { MigrationInterface, QueryRunner } from "typeorm";

export class ContentPreferencesReadIndexes1731520135216 implements MigrationInterface {
    name = 'ContentPreferencesReadIndexes1731520135216'

    public async up(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_content_preferences_referenceid_type_status" ON "content_preference" ("referenceId", "type", "status")`);

      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_content_preferences_userid_referenceid_type" ON "content_preference" ("userId", "referenceId", "type")`);

      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_content_preferences_feedid_type_status" ON "content_preference" ("feedId", "type", "status")`);

      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_content_preferences_feedid_type_userid_status" ON "content_preference" ("feedId", "type", "userId", "status")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`DROP INDEX IF EXISTS "idx_content_preferences_referenceid_type_status"`);

      await queryRunner.query(`DROP INDEX IF EXISTS "idx_content_preferences_userid_referenceid_type"`);

      await queryRunner.query(`DROP INDEX IF EXISTS "idx_content_preferences_feedid_type_status"`);

      await queryRunner.query(`DROP INDEX IF EXISTS "idx_content_preferences_feedid_type_userid_status"`);
    }

}
