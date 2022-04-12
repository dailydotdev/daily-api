import { MigrationInterface, QueryRunner } from 'typeorm';

export class FeaturedCommentRemoval1649767853966 implements MigrationInterface {
  name = 'FeaturedCommentRemoval1649767853966';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_comment_featured"`);
    await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "featured"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "comment" ADD "featured" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comment_featured" ON "comment" ("featured") `,
    );
  }
}
