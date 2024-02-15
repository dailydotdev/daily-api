import { MigrationInterface, QueryRunner } from 'typeorm';

export class NewIndexes1707983477045 implements MigrationInterface {
  name = 'NewIndexes1707983477045';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_post_deleted_visible_type_views" ON "post" ("deleted", "visible", "type", "views" DESC) `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_source_activ_priva_img_name_handl_type" ON "source" ("active", "private", "image", "name", "handle", "type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_source_member_sourceId_role" ON "source_member" ("sourceId", "role") `,
    );
    await queryRunner.query(
      `CREATE INDEX "user_idx_lowerusername_username" ON "user" ((lower(username)),"username")`,
    );
    await queryRunner.query(
      `CREATE INDEX "user_idx_lowertwitter" ON "user" ((lower(twitter)))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_post_deleted_visible_type_views"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_source_activ_priva_img_name_handl_type"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_source_member_sourceId_role"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."user_idx_lowerusername_username"`,
    );
    await queryRunner.query(`DROP INDEX "public"."user_idx_lowertwitter"`);
  }
}
