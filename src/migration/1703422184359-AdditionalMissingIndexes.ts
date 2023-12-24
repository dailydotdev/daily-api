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
  }
}
