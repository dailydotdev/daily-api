import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdditionalMissingIndexes1703422184359
  implements MigrationInterface
{
  name = 'AdditionalMissingIndexes1703422184359';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_source_member_userId_role" ON "source_member" ("userId", "role") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_source_type_id" ON "source" ("type", "id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_visible_type" ON "post" ("visible", "type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_visible_sourceid" ON "post" ("visible", "sourceId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_visible_metadatachanged" ON "post" ("visible", "metadataChangedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_keyword_status_value_occurrences" ON "keyword" ("status", "value", "occurrences") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_visible_deleted_id" ON "post" ("visible", "deleted", "id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_deleted_visible_banned_showonfeed_id_type" ON "post" ("deleted", "visible", "banned", "showOnFeed", "id", "type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_visible_deleted_createdat" ON "post" ("visible", "deleted", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_keyword_keyword_postid" ON "post_keyword" ("keyword", "postId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_source_private_id" ON "source" ("private", "id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_post_postid_userid_hidden" ON "user_post" ("postId", "userId", "hidden") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_source_type_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_source_member_userId_role"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_post_visible_type"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_post_visible_sourceid"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_post_visible_metadatachanged"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_keyword_status_value_occurrences"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_post_visible_deleted_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_post_deleted_visible_banned_showonfeed_id_type"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_post_visible_deleted_createdat"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_post_keyword_keyword_postid"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_source_private_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_post_postid_userid_hidden"`,
    );
  }
}
