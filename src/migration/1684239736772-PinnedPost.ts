import { MigrationInterface, QueryRunner } from 'typeorm';
import { PostType } from '../entity/posts/Post';

export class PinnedPost1684239736772 implements MigrationInterface {
  name = 'PinnedPost1684239736772';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "post"
      ADD "pinnedAt" TIMESTAMP`);
    await queryRunner.query(
      `CREATE INDEX "IDX_b1bed11be2023dbf95943dd4a3" ON "post" ("pinnedAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_post_source_id_pinned_at_created_at" ON "post" ("sourceId", "pinnedAt", "createdAt") `,
    );

    await queryRunner.query(
      `UPDATE "post"
       SET "pinnedAt" = now()
       WHERE "type" = '${PostType.Welcome}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_post_source_id_pinned_at_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b1bed11be2023dbf95943dd4a3"`,
    );
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "pinnedAt"`);
  }
}
