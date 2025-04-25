import { MigrationInterface, QueryRunner } from "typeorm";

export class PostSourceIndex1745511937419 implements MigrationInterface {
  name = 'PostSourceIndex1745511937419'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`
      CREATE INDEX IF NOT EXISTS "IDX_post_source_id_pinned_at_null_pinned_at_created_at" ON "post" (
        "sourceId", ("pinnedAt" IS NULL), "pinnedAt" DESC, "createdAt" DESC
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(/* sql */`DROP INDEX IF EXISTS "IDX_post_source_id_pinned_at_null_pinned_at_created_at";`);
  }
}
