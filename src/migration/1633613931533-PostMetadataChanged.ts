import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostMetadataChanged1633613931533 implements MigrationInterface {
  name = 'PostMetadataChanged1633613931533';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "public"."post"
      ADD "metadataChangedAt" TIMESTAMP NOT NULL DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "public"."post"
      ADD "deleted" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(
      `CREATE INDEX "IDX_post_metadataChangedAt" ON "public"."post" ("metadataChangedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_deleted" ON "public"."post" ("deleted") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_post_deleted"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_post_metadataChangedAt"`);
    await queryRunner.query(`ALTER TABLE "public"."post"
      DROP COLUMN "deleted"`);
    await queryRunner.query(`ALTER TABLE "public"."post"
      DROP COLUMN "metadataChangedAt"`);
  }
}
